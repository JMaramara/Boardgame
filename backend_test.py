
import requests
import sys
import json
from datetime import datetime

class BGGCatalogTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_game_id = None
        self.collection_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            status_success = response.status_code == expected_status
            
            if status_success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.text else {}
                except json.JSONDecodeError:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_search_games(self, query):
        """Test the search endpoint"""
        print(f"\n📚 Testing search for '{query}'...")
        success, response = self.run_test(
            f"Search for '{query}'",
            "GET",
            f"api/search",
            200,
            params={"q": query}
        )
        
        if success and response:
            print(f"Found {len(response)} games")
            if len(response) > 0:
                print(f"First result: {response[0]['name']} (BGG ID: {response[0]['bgg_id']})")
                self.test_game_id = response[0]['bgg_id']
            return True
        return False

    def test_game_details(self, bgg_id):
        """Test the game details endpoint"""
        print(f"\n🎲 Testing game details for BGG ID: {bgg_id}")
        success, response = self.run_test(
            f"Get game details for BGG ID: {bgg_id}",
            "GET",
            f"api/games/{bgg_id}",
            200
        )
        
        if success and response:
            print(f"Game details: {response['name']} ({response['year_published']})")
            print(f"Players: {response['min_players']}-{response['max_players']}")
            if response.get('bgg_rating'):
                print(f"Rating: {response['bgg_rating']}")
            return True
        return False

    def test_add_to_collection(self, bgg_id, is_wishlist=False):
        """Test adding a game to collection"""
        collection_type = "wishlist" if is_wishlist else "collection"
        print(f"\n➕ Testing add to {collection_type} for BGG ID: {bgg_id}")
        
        data = {
            "bgg_id": bgg_id,
            "user_notes": f"Test note added on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "custom_tags": ["test", "api-test"],
            "is_wishlist": is_wishlist
        }
        
        success, response = self.run_test(
            f"Add to {collection_type}",
            "POST",
            "api/collection",
            200,
            data=data
        )
        
        if success and response:
            print(f"Added to {collection_type}: {response['game']['name']}")
            self.collection_id = response['id']
            return True
        return False

    def test_get_collection(self, is_wishlist=False):
        """Test getting the collection or wishlist"""
        collection_type = "wishlist" if is_wishlist else "collection"
        print(f"\n📋 Testing get {collection_type}")
        
        success, response = self.run_test(
            f"Get {collection_type}",
            "GET",
            "api/collection",
            200,
            params={"is_wishlist": str(is_wishlist).lower()}
        )
        
        if success:
            print(f"Found {len(response)} items in {collection_type}")
            if len(response) > 0:
                print(f"First item: {response[0]['game']['name']}")
            return True
        return False

    def test_remove_from_collection(self, collection_id):
        """Test removing a game from collection"""
        print(f"\n❌ Testing remove from collection: {collection_id}")
        
        success, _ = self.run_test(
            "Remove from collection",
            "DELETE",
            f"api/collection/{collection_id}",
            200
        )
        
        if success:
            print(f"Successfully removed item from collection")
            return True
        return False

def main():
    # Get the backend URL from the environment variable
    backend_url = "https://68a73372-0a64-4633-a6cb-5714bb6ae5eb.preview.emergentagent.com"
    
    print(f"🚀 Starting BGG Catalog API Tests against {backend_url}")
    
    # Setup tester
    tester = BGGCatalogTester(backend_url)
    
    # Test search endpoint
    if not tester.test_search_games("catan"):
        print("❌ Search test failed, stopping tests")
        return 1
    
    # Test game details endpoint
    if tester.test_game_id and not tester.test_game_details(tester.test_game_id):
        print("❌ Game details test failed, stopping tests")
        return 1
    
    # Test collection endpoints
    if tester.test_game_id:
        # Test adding to collection
        if not tester.test_add_to_collection(tester.test_game_id, is_wishlist=False):
            print("❌ Add to collection test failed")
        
        # Test getting collection
        if not tester.test_get_collection(is_wishlist=False):
            print("❌ Get collection test failed")
        
        # Test adding to wishlist
        if not tester.test_add_to_collection(tester.test_game_id, is_wishlist=True):
            print("❌ Add to wishlist test failed")
        
        # Test getting wishlist
        if not tester.test_get_collection(is_wishlist=True):
            print("❌ Get wishlist test failed")
        
        # Test removing from collection
        if tester.collection_id and not tester.test_remove_from_collection(tester.collection_id):
            print("❌ Remove from collection test failed")
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
