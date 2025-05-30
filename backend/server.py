from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import httpx
import xmltodict
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class GameBasic(BaseModel):
    bgg_id: str
    name: str
    year_published: Optional[str] = None

class Game(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bgg_id: str
    name: str
    year_published: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    min_players: Optional[int] = None
    max_players: Optional[int] = None
    min_playtime: Optional[int] = None
    max_playtime: Optional[int] = None
    min_age: Optional[int] = None
    bgg_rating: Optional[float] = None
    bgg_rating_count: Optional[int] = None
    categories: List[str] = Field(default_factory=list)
    mechanics: List[str] = Field(default_factory=list)
    publishers: List[str] = Field(default_factory=list)
    designers: List[str] = Field(default_factory=list)

class CollectionGame(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    game: Game
    user_notes: Optional[str] = None
    custom_tags: List[str] = Field(default_factory=list)
    date_added: datetime = Field(default_factory=datetime.utcnow)
    is_wishlist: bool = False
    wishlist_priority: Optional[int] = None

class AddToCollectionRequest(BaseModel):
    bgg_id: str
    user_notes: Optional[str] = None
    custom_tags: List[str] = Field(default_factory=list)
    is_wishlist: bool = False
    wishlist_priority: Optional[int] = None


# BGG API Integration
class BGGService:
    BASE_URL = "https://boardgamegeek.com/xmlapi2"
    
    @staticmethod
    async def search_games(query: str) -> List[GameBasic]:
        """Search for games on BGG"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{BGGService.BASE_URL}/search",
                    params={"query": query, "type": "boardgame"}
                )
                response.raise_for_status()
                
                data = xmltodict.parse(response.content)
                if 'items' not in data or not data['items'] or 'item' not in data['items']:
                    return []
                
                items = data['items']['item']
                if not isinstance(items, list):
                    items = [items]
                
                games = []
                for item in items[:10]:  # Limit to 10 results
                    name = item.get('name', {})
                    if isinstance(name, list):
                        name = name[0]
                    
                    year_elem = item.get('yearpublished', {})
                    year = year_elem.get('@value') if year_elem else None
                    
                    games.append(GameBasic(
                        bgg_id=item['@id'],
                        name=name.get('@value', 'Unknown') if isinstance(name, dict) else str(name),
                        year_published=year
                    ))
                
                return games
            except Exception as e:
                logging.error(f"Error searching BGG: {e}")
                return []
    
    @staticmethod
    async def get_game_details(bgg_id: str) -> Optional[Game]:
        """Get detailed game information from BGG"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{BGGService.BASE_URL}/thing",
                    params={"id": bgg_id, "stats": "1"}
                )
                response.raise_for_status()
                
                data = xmltodict.parse(response.content)
                if 'items' not in data or not data['items'] or 'item' not in data['items']:
                    return None
                
                item = data['items']['item']
                
                # Extract basic info
                names = item.get('name', [])
                if not isinstance(names, list):
                    names = [names]
                primary_name = next((n['@value'] for n in names if n.get('@type') == 'primary'), 
                                  names[0]['@value'] if names else 'Unknown')
                
                # Extract other details
                year_elem = item.get('yearpublished', {})
                year = year_elem.get('@value') if year_elem else None
                
                description_elem = item.get('description', '')
                description = description_elem if isinstance(description_elem, str) else ''
                
                image_url = item.get('image', '')
                thumbnail_url = item.get('thumbnail', '')
                
                # Player count and playtime
                min_players_elem = item.get('minplayers', {})
                min_players = int(min_players_elem.get('@value', 0)) if min_players_elem else None
                
                max_players_elem = item.get('maxplayers', {})
                max_players = int(max_players_elem.get('@value', 0)) if max_players_elem else None
                
                min_playtime_elem = item.get('minplaytime', {})
                min_playtime = int(min_playtime_elem.get('@value', 0)) if min_playtime_elem else None
                
                max_playtime_elem = item.get('maxplaytime', {})
                max_playtime = int(max_playtime_elem.get('@value', 0)) if max_playtime_elem else None
                
                min_age_elem = item.get('minage', {})
                min_age = int(min_age_elem.get('@value', 0)) if min_age_elem else None
                
                # Ratings
                stats = item.get('statistics', {}).get('ratings', {})
                rating_elem = stats.get('average', {})
                rating = float(rating_elem.get('@value', 0)) if rating_elem else None
                
                rating_count_elem = stats.get('usersrated', {})
                rating_count = int(rating_count_elem.get('@value', 0)) if rating_count_elem else None
                
                # Categories and mechanics
                links = item.get('link', [])
                if not isinstance(links, list):
                    links = [links]
                
                categories = [link['@value'] for link in links if link.get('@type') == 'boardgamecategory']
                mechanics = [link['@value'] for link in links if link.get('@type') == 'boardgamemechanic']
                publishers = [link['@value'] for link in links if link.get('@type') == 'boardgamepublisher']
                designers = [link['@value'] for link in links if link.get('@type') == 'boardgamedesigner']
                
                return Game(
                    bgg_id=bgg_id,
                    name=primary_name,
                    year_published=year,
                    description=description,
                    image_url=image_url,
                    thumbnail_url=thumbnail_url,
                    min_players=min_players,
                    max_players=max_players,
                    min_playtime=min_playtime,
                    max_playtime=max_playtime,
                    min_age=min_age,
                    bgg_rating=rating,
                    bgg_rating_count=rating_count,
                    categories=categories,
                    mechanics=mechanics,
                    publishers=publishers,
                    designers=designers
                )
                
            except Exception as e:
                logging.error(f"Error getting game details from BGG: {e}")
                return None


# API Routes
@api_router.get("/")
async def root():
    return {"message": "Board Game Catalog API"}

@api_router.get("/search", response_model=List[GameBasic])
async def search_games(q: str = Query(..., min_length=2)):
    """Search for games on BoardGameGeek"""
    return await BGGService.search_games(q)

@api_router.get("/games/{bgg_id}", response_model=Game)
async def get_game_details(bgg_id: str):
    """Get detailed game information from BGG"""
    game = await BGGService.get_game_details(bgg_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@api_router.post("/collection", response_model=CollectionGame)
async def add_to_collection(request: AddToCollectionRequest):
    """Add a game to the collection"""
    # Get game details from BGG
    game = await BGGService.get_game_details(request.bgg_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found on BGG")
    
    # Check if already in collection
    existing = await db.collection.find_one({
        "game.bgg_id": request.bgg_id, 
        "is_wishlist": request.is_wishlist
    })
    if existing:
        raise HTTPException(status_code=400, detail="Game already in collection")
    
    # Create collection entry
    collection_game = CollectionGame(
        game=game,
        user_notes=request.user_notes,
        custom_tags=request.custom_tags,
        is_wishlist=request.is_wishlist,
        wishlist_priority=request.wishlist_priority
    )
    
    # Save to database
    await db.collection.insert_one(collection_game.dict())
    return collection_game

@api_router.get("/collection", response_model=List[CollectionGame])
async def get_collection(is_wishlist: bool = False):
    """Get user's collection or wishlist"""
    collection = await db.collection.find({"is_wishlist": is_wishlist}).to_list(1000)
    return [CollectionGame(**item) for item in collection]

@api_router.delete("/collection/{collection_id}")
async def remove_from_collection(collection_id: str):
    """Remove a game from collection"""
    result = await db.collection.delete_one({"id": collection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collection item not found")
    return {"message": "Game removed from collection"}

@api_router.put("/collection/{collection_id}", response_model=CollectionGame)
async def update_collection_item(collection_id: str, user_notes: Optional[str] = None, custom_tags: List[str] = None):
    """Update collection item notes and tags"""
    update_data = {}
    if user_notes is not None:
        update_data["user_notes"] = user_notes
    if custom_tags is not None:
        update_data["custom_tags"] = custom_tags
    
    result = await db.collection.find_one_and_update(
        {"id": collection_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Collection item not found")
    
    return CollectionGame(**result)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
