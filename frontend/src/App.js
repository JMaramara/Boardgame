import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Game Search Component
const GameSearch = ({ onGameSelect }) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const searchGames = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchGames(value);
    }, 300);
    setSearchTimeout(timeout);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative">
        <input
          type="text"
          placeholder="Search for board games..."
          value={query}
          onChange={handleInputChange}
          className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading && (
        <div className="mt-4 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {searchResults.map((game) => (
            <div
              key={game.bgg_id}
              onClick={() => onGameSelect(game)}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-semibold text-gray-900">{game.name}</div>
              {game.year_published && (
                <div className="text-sm text-gray-500">Published: {game.year_published}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Game Details Modal
const GameDetailsModal = ({ game, onClose, onAddToCollection }) => {
  const [loading, setLoading] = useState(true);
  const [gameDetails, setGameDetails] = useState(null);
  const [userNotes, setUserNotes] = useState('');
  const [customTags, setCustomTags] = useState('');
  const [isWishlist, setIsWishlist] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchGameDetails();
  }, [game.bgg_id]);

  const fetchGameDetails = async () => {
    try {
      const response = await axios.get(`${API}/games/${game.bgg_id}`);
      setGameDetails(response.data);
    } catch (error) {
      console.error('Error fetching game details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollection = async () => {
    setAdding(true);
    try {
      const tags = customTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await axios.post(`${API}/collection`, {
        bgg_id: game.bgg_id,
        user_notes: userNotes,
        custom_tags: tags,
        is_wishlist: isWishlist
      });
      onAddToCollection();
      onClose();
    } catch (error) {
      console.error('Error adding to collection:', error);
      alert('Error adding game to collection. It might already be in your collection.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{gameDetails?.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {gameDetails && (
            <div className="space-y-4">
              {gameDetails.image_url && (
                <img 
                  src={gameDetails.image_url} 
                  alt={gameDetails.name}
                  className="w-48 h-48 object-cover rounded-lg mx-auto"
                />
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Year:</strong> {gameDetails.year_published || 'Unknown'}</div>
                <div><strong>Players:</strong> {gameDetails.min_players}-{gameDetails.max_players}</div>
                <div><strong>Playtime:</strong> {gameDetails.min_playtime}-{gameDetails.max_playtime} min</div>
                <div><strong>Age:</strong> {gameDetails.min_age}+</div>
                {gameDetails.bgg_rating && (
                  <div><strong>BGG Rating:</strong> {gameDetails.bgg_rating.toFixed(1)}/10</div>
                )}
                {gameDetails.bgg_rating_count && (
                  <div><strong>Votes:</strong> {gameDetails.bgg_rating_count.toLocaleString()}</div>
                )}
              </div>

              {gameDetails.description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                    {gameDetails.description.replace(/<[^>]*>/g, '')}
                  </p>
                </div>
              )}

              {gameDetails.categories.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {gameDetails.categories.slice(0, 5).map((category, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Add to Collection</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="wishlist"
                      checked={isWishlist}
                      onChange={(e) => setIsWishlist(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="wishlist" className="text-sm">Add to Wishlist</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Personal Notes
                    </label>
                    <textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Add your thoughts about this game..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={customTags}
                      onChange={(e) => setCustomTags(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Strategy, Co-op, Family-friendly..."
                    />
                  </div>

                  <button
                    onClick={handleAddToCollection}
                    disabled={adding}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adding ? 'Adding...' : `Add to ${isWishlist ? 'Wishlist' : 'Collection'}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Collection Display Component
const Collection = ({ isWishlist = false, onRefresh }) => {
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollection();
  }, [isWishlist]);

  const fetchCollection = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/collection?is_wishlist=${isWishlist}`);
      setCollection(response.data);
    } catch (error) {
      console.error('Error fetching collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromCollection = async (collectionId) => {
    try {
      await axios.delete(`${API}/collection/${collectionId}`);
      fetchCollection();
      onRefresh();
    } catch (error) {
      console.error('Error removing from collection:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (collection.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-6xl mb-4">🎲</div>
        <p>Your {isWishlist ? 'wishlist' : 'collection'} is empty.</p>
        <p className="text-sm">Search for games above to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {collection.map((item) => (
        <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden">
          {item.game.thumbnail_url && (
            <img 
              src={item.game.thumbnail_url} 
              alt={item.game.name}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-4">
            <h3 className="font-bold text-lg mb-2">{item.game.name}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Year: {item.game.year_published || 'Unknown'}</div>
              <div>Players: {item.game.min_players}-{item.game.max_players}</div>
              {item.game.bgg_rating && (
                <div>Rating: {item.game.bgg_rating.toFixed(1)}/10</div>
              )}
            </div>
            
            {item.custom_tags.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1">
                  {item.custom_tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.user_notes && (
              <div className="mt-3">
                <p className="text-sm text-gray-700">{item.user_notes}</p>
              </div>
            )}

            <div className="mt-4 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Added {new Date(item.date_added).toLocaleDateString()}
              </span>
              <button
                onClick={() => removeFromCollection(item.id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Main App Component
function App() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [collectionCount, setCollectionCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    fetchCounts();
  }, []);

  const fetchCounts = async () => {
    try {
      const [collectionRes, wishlistRes] = await Promise.all([
        axios.get(`${API}/collection?is_wishlist=false`),
        axios.get(`${API}/collection?is_wishlist=true`)
      ]);
      setCollectionCount(collectionRes.data.length);
      setWishlistCount(wishlistRes.data.length);
    } catch (error) {
      console.error('Error fetching counts:', error);
    }
  };

  const handleGameSelect = (game) => {
    setSelectedGame(game);
  };

  const handleAddToCollection = () => {
    fetchCounts();
  };

  const tabs = [
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'collection', label: `Collection (${collectionCount})`, icon: '📚' },
    { id: 'wishlist', label: `Wishlist (${wishlistCount})`, icon: '⭐' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                Your Board Game Library
              </h1>
              <p className="text-xl md:text-2xl mb-6 opacity-90">
                The Steam for board games. Catalog, organize, and discover your perfect game night.
              </p>
            </div>
            <div className="md:w-1/2">
              <img 
                src="https://images.pexels.com/photos/6989963/pexels-photo-6989963.jpeg" 
                alt="Board games collection"
                className="rounded-lg shadow-2xl w-full max-w-md mx-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'search' && (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Find Your Next Game</h2>
              <p className="text-gray-600">Search BoardGameGeek's database of thousands of games</p>
            </div>
            <GameSearch onGameSelect={handleGameSelect} />
          </div>
        )}

        {activeTab === 'collection' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">My Collection</h2>
              <p className="text-gray-600">Games you own and love</p>
            </div>
            <Collection isWishlist={false} onRefresh={fetchCounts} />
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">My Wishlist</h2>
              <p className="text-gray-600">Games you want to add to your collection</p>
            </div>
            <Collection isWishlist={true} onRefresh={fetchCounts} />
          </div>
        )}
      </div>

      {/* Game Details Modal */}
      {selectedGame && (
        <GameDetailsModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onAddToCollection={handleAddToCollection}
        />
      )}
    </div>
  );
}

export default App;