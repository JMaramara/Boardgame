
import requests
import sys
import json
import uuid
from datetime import datetime

class BGGCatalogTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_game_id = None
        self.collection_id = None
        self.auth_token = None
        self.test_username = f"testuser_{uuid.uuid4().hex[:8]}"
        self.test_password = "TestPassword123!"
        self.test_email = f"{self.test_username}@example.com"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None, auth=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add auth token if required and available
        if auth and self.auth_token:
            headers['Authorization'] = f'Bearer {self.auth_token}'
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
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

    # Authentication Tests
    def test_user_registration(self):
        """Test user registration"""
        print(f"\n👤 Testing user registration for '{self.test_username}'...")
        
        data = {
            "username": self.test_username,
            "email": self.test_email,
            "password": self.test_password
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "api/auth/register",
            200,
            data=data
        )
        
        if success and response.get('access_token'):
            print(f"User registered successfully: {self.test_username}")
            self.auth_token = response['access_token']
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        print(f"\n🔑 Testing user login for '{self.test_username}'...")
        
        data = {
            "username": self.test_username,
            "password": self.test_password
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "api/auth/login",
            200,
            data=data
        )
        
        if success and response.get('access_token'):
            print(f"User logged in successfully: {self.test_username}")
            self.auth_token = response['access_token']
            return True
        return False

    def test_get_profile(self):
        """Test getting user profile"""
        print(f"\n👤 Testing get user profile for '{self.test_username}'...")
        
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "api/auth/profile",
            200,
            auth=True
        )
        
        if success:
            print(f"Username: {response.get('username')}")
            print(f"Collection count: {response.get('collection_count')}")
            print(f"Wishlist count: {response.get('wishlist_count')}")
            return True
        return False

    # Game Search Tests
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

    # Collection Tests with Authentication
    def test_add_to_collection(self, bgg_id, is_wishlist=False):
        """Test adding a game to collection"""
        collection_type = "wishlist" if is_wishlist else "collection"
        print(f"\n➕ Testing add to {collection_type} for BGG ID: {bgg_id}")
        
        data = {
            "bgg_id": bgg_id,
            "user_notes": f"Test note added on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "custom_tags": ["test", "api-test", "favorite"],
            "is_wishlist": is_wishlist,
            "wishlist_priority": 3 if is_wishlist else None
        }
        
        success, response = self.run_test(
            f"Add to {collection_type}",
            "POST",
            "api/collection",
            200,
            data=data,
            auth=True
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
            params={"is_wishlist": str(is_wishlist).lower()},
            auth=True
        )
        
        if success:
            print(f"Found {len(response)} items in {collection_type}")
            if len(response) > 0:
                print(f"First item: {response[0]['game']['name']}")
            return True
        return False

    def test_update_collection_item(self, collection_id):
        """Test updating a collection item"""
        print(f"\n✏️ Testing update collection item: {collection_id}")
        
        data = {
            "user_notes": f"Updated note on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "custom_tags": ["test", "updated", "favorite"]
        }
        
        success, response = self.run_test(
            "Update collection item",
            "PUT",
            f"api/collection/{collection_id}",
            200,
            data=data,
            auth=True
        )
        
        if success and response:
            print(f"Successfully updated item: {response['game']['name']}")
            print(f"Updated notes: {response['user_notes']}")
            print(f"Updated tags: {response['custom_tags']}")
            return True
        return False

    def test_remove_from_collection(self, collection_id):
        """Test removing a game from collection"""
        print(f"\n❌ Testing remove from collection: {collection_id}")
        
        success, _ = self.run_test(
            "Remove from collection",
            "DELETE",
            f"api/collection/{collection_id}",
            200,
            auth=True
        )
        
        if success:
            print(f"Successfully removed item from collection")
            return True
        return False

    # Public Profile Tests
    def test_public_profile(self, username):
        """Test accessing a public profile"""
        print(f"\n👥 Testing public profile for '{username}'...")
        
        # This will likely fail as profiles are private by default
        success, response = self.run_test(
            "Get Public Profile",
            "GET",
            f"api/public/{username}",
            403  # Expecting forbidden as profiles are private by default
        )
        
        # We're expecting a 403 here, so success means we got the expected 403
        if success:
            print(f"Correctly received 403 for private profile")
            return True
        return False

def main():
    # Get the backend URL from the environment variable
    backend_url = "https://68a73372-0a64-4633-a6cb-5714bb6ae5eb.preview.emergentagent.com"
    
    print(f"🚀 Starting Enhanced BGG Catalog API Tests against {backend_url}")
    
    # Setup tester
    tester = BGGCatalogTester(backend_url)
    
    # Test Authentication
    print("\n==== Authentication Tests ====")
    if not tester.test_user_registration():
        print("❌ User registration test failed, stopping tests")
        return 1
    
    if not tester.test_get_profile():
        print("❌ Get profile test failed")
    
    # Test logging out and back in
    tester.auth_token = None
    if not tester.test_user_login():
        print("❌ User login test failed")
    
    # Test Game Search
    print("\n==== Game Search Tests ====")
    if not tester.test_search_games("catan"):
        print("❌ Search test failed, stopping tests")
        return 1
    
    if tester.test_game_id and not tester.test_game_details(tester.test_game_id):
        print("❌ Game details test failed, stopping tests")
        return 1
    
    # Test Collection with Authentication
    print("\n==== Collection Tests ====")
    if tester.test_game_id and tester.auth_token:
        # Test adding to collection
        if not tester.test_add_to_collection(tester.test_game_id, is_wishlist=False):
            print("❌ Add to collection test failed")
        
        # Test getting collection
        if not tester.test_get_collection(is_wishlist=False):
            print("❌ Get collection test failed")
        
        # Test updating collection item
        if tester.collection_id and not tester.test_update_collection_item(tester.collection_id):
            print("❌ Update collection item test failed")
        
        # Test adding to wishlist
        if not tester.test_add_to_collection(tester.test_game_id, is_wishlist=True):
            print("❌ Add to wishlist test failed")
        
        # Test getting wishlist
        if not tester.test_get_collection(is_wishlist=True):
            print("❌ Get wishlist test failed")
        
        # Test removing from collection
        if tester.collection_id and not tester.test_remove_from_collection(tester.collection_id):
            print("❌ Remove from collection test failed")
    
    # Test Public Profile
    print("\n==== Public Profile Tests ====")
    if tester.test_username:
        if not tester.test_public_profile(tester.test_username):
            print("❌ Public profile test failed")
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
