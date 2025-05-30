from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
import xmltodict
import asyncio
import hashlib
import jwt
from passlib.context import CryptContext


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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


# User Authentication Models
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime
    collection_count: int = 0
    wishlist_count: int = 0
    is_public: bool = False


# Authentication Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

# Optional auth - for endpoints that work with or without auth
async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    if credentials is None:
        return None
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = await db.users.find_one({"username": username})
        if user is None:
            return None
        return User(**user)
    except jwt.PyJWTError:
        return None


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

# Authentication Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user"""
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"username": user_data.username}, {"email": user_data.email}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        username=user_data.username,
        email=user_data.email
    )
    
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    await db.users.insert_one(user_dict)
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    """Login user"""
    user = await db.users.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/profile", response_model=UserProfile)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile with collection stats"""
    collection_count = await db.collection.count_documents({"user_id": current_user.id, "is_wishlist": False})
    wishlist_count = await db.collection.count_documents({"user_id": current_user.id, "is_wishlist": True})
    
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        created_at=current_user.created_at,
        collection_count=collection_count,
        wishlist_count=wishlist_count
    )

# Game Search Routes (No auth required)
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

# Collection Routes (Auth optional for now, required for modifications)
@api_router.post("/collection", response_model=CollectionGame)
async def add_to_collection(request: AddToCollectionRequest, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Add a game to the collection"""
    # For now, we'll use a default user_id if not authenticated
    user_id = current_user.id if current_user else "anonymous"
    
    # Get game details from BGG
    game = await BGGService.get_game_details(request.bgg_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found on BGG")
    
    # Check if already in collection
    existing = await db.collection.find_one({
        "user_id": user_id,
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
    
    # Add user_id to the document
    collection_dict = collection_game.dict()
    collection_dict["user_id"] = user_id
    
    # Save to database
    await db.collection.insert_one(collection_dict)
    return collection_game

@api_router.get("/collection", response_model=List[CollectionGame])
async def get_collection(is_wishlist: bool = False, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Get user's collection or wishlist"""
    user_id = current_user.id if current_user else "anonymous"
    
    collection = await db.collection.find({
        "user_id": user_id,
        "is_wishlist": is_wishlist
    }).to_list(1000)
    
    return [CollectionGame(**item) for item in collection]

@api_router.delete("/collection/{collection_id}")
async def remove_from_collection(collection_id: str, current_user: Optional[User] = Depends(get_current_user_optional)):
    """Remove a game from collection"""
    user_id = current_user.id if current_user else "anonymous"
    
    result = await db.collection.delete_one({
        "id": collection_id,
        "user_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collection item not found")
    return {"message": "Game removed from collection"}

@api_router.put("/collection/{collection_id}", response_model=CollectionGame)
async def update_collection_item(
    collection_id: str,
    update_data: Dict[str, Any],
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Update collection item notes and tags"""
    user_id = current_user.id if current_user else "anonymous"
    
    # Extract valid fields from update_data
    allowed_fields = {"user_notes", "custom_tags"}
    filtered_update = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not filtered_update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await db.collection.find_one_and_update(
        {"id": collection_id, "user_id": user_id},
        {"$set": filtered_update},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Collection item not found")
    
    return CollectionGame(**result)

# Public Profile Routes
@api_router.get("/public/{username}", response_model=UserProfile)
async def get_public_profile(username: str):
    """Get public user profile"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("is_public", False):
        raise HTTPException(status_code=403, detail="Profile is private")
    
    collection_count = await db.collection.count_documents({"user_id": user["id"], "is_wishlist": False})
    wishlist_count = await db.collection.count_documents({"user_id": user["id"], "is_wishlist": True})
    
    return UserProfile(
        id=user["id"],
        username=user["username"],
        email=user["email"],  # Consider hiding email in public profiles
        created_at=user["created_at"],
        collection_count=collection_count,
        wishlist_count=wishlist_count,
        is_public=user.get("is_public", False)
    )

@api_router.get("/public/{username}/collection", response_model=List[CollectionGame])
async def get_public_collection(username: str, is_wishlist: bool = False):
    """Get public user's collection"""
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.get("is_public", False):
        raise HTTPException(status_code=403, detail="Profile is private")
    
    collection = await db.collection.find({
        "user_id": user["id"],
        "is_wishlist": is_wishlist
    }).to_list(1000)
    
    return [CollectionGame(**item) for item in collection]


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
