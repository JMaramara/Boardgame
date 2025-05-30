# File: backend/routers/bgg.py

import requests
import xml.etree.ElementTree as ET
from fastapi import APIRouter, HTTPException, Query

# Create a new router instance. This is like a mini-FastAPI app.
router = APIRouter()

# Define the base URL for the BoardGameGeek API2
BGG_API_URL = "https://www.boardgamegeek.com/xmlapi2"


@router.get("/search")
async def search_bgg_by_name(query: str = Query(..., min_length=3, description="Search query for a board game")):
    """
    Searches the BoardGameGeek API for games matching the query.
    """
    # Use the 'requests' library to send a GET request to the BGG API's search endpoint
    try:
        response = requests.get(
            f"{BGG_API_URL}/search",
            params={"query": query, "type": "boardgame"}
        )
        response.raise_for_status()  # This will raise an exception for bad responses (4xx or 5xx)
    except requests.exceptions.RequestException as e:
        # If the request fails, return a server error
        raise HTTPException(status_code=503, detail=f"Error communicating with BGG API: {e}")

    # Parse the XML response from BGG
    root = ET.fromstring(response.content)

    # Prepare a list to hold the search results
    results = []

    # Find each 'item' tag in the XML, which represents a single game
    for item in root.findall('item'):
        # Extract the details for each game. Use .get() to avoid errors if an attribute is missing.
        bgg_id = item.get('id')
        name_element = item.find('name')
        year_element = item.find('yearpublished')

        # Add the game details to our results list
        if bgg_id and name_element is not None:
            results.append({
                "bgg_id": int(bgg_id),
                "name": name_element.get('value'),
                "year_published": int(year_element.get('value')) if year_element is not None else None,
            })

    return {"item_count": len(results), "results": results}
