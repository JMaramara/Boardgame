import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Icons Components
const SearchIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const StarIcon = ({ filled = false }) => (
  <svg className={`h-5 w-5 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

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

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      searchGames(value);
    }, 300);
    setSearchTimeout(timeout);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          placeholder="Search for board games..."
          value={query}
          onChange={handleInputChange}
          className="w-full px-6 py-4 pl-14 text-lg bg-white border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-lg"
        />
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-5 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4 bg-white border border-gray-100 rounded-2xl shadow-2xl max-h-80 overflow-y-auto">
          {searchResults.map((game, index) => (
            <div
              key={game.bgg_id}
              onClick={() => onGameSelect(game)}
              className={`p-4 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 cursor-pointer transition-all duration-200 ${
                index !== searchResults.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="font-semibold text-gray-900 text-lg">{game.name}</div>
              {game.year_published && (
                <div className="text-sm text-gray-500 mt-1">Published in {game.year_published}</div>
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
      alert('This game is already in your collection!');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl shadow-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading game details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="relative">
          {/* Header with close button */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg hover:bg-white transition-all duration-200"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Game image header */}
          {gameDetails?.image_url && (
            <div className="relative h-64 bg-gradient-to-br from-blue-600 to-purple-700">
              <img 
                src={gameDetails.image_url} 
                alt={gameDetails.name}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <h1 className="text-3xl font-bold mb-2">{gameDetails.name}</h1>
                <div className="flex items-center space-x-4 text-sm">
                  <span>{gameDetails.year_published}</span>
                  {gameDetails.bgg_rating && (
                    <div className="flex items-center space-x-1">
                      <StarIcon filled />
                      <span>{gameDetails.bgg_rating.toFixed(1)}/10</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="p-8 overflow-y-auto max-h-[60vh]">
            {/* Game stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl">
                <UsersIcon />
                <div className="font-semibold text-gray-900 mt-2">{gameDetails?.min_players}-{gameDetails?.max_players}</div>
                <div className="text-sm text-gray-600">Players</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl">
                <ClockIcon />
                <div className="font-semibold text-gray-900 mt-2">{gameDetails?.min_playtime}-{gameDetails?.max_playtime}</div>
                <div className="text-sm text-gray-600">Minutes</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl">
                <span className="text-2xl">🎯</span>
                <div className="font-semibold text-gray-900 mt-2">{gameDetails?.min_age}+</div>
                <div className="text-sm text-gray-600">Age</div>
              </div>
              {gameDetails?.bgg_rating_count && (
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl">
                  <span className="text-2xl">👥</span>
                  <div className="font-semibold text-gray-900 mt-2">{gameDetails.bgg_rating_count.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Reviews</div>
                </div>
              )}
            </div>

            {/* Description */}
            {gameDetails?.description && (
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-900">Description</h3>
                <div className="prose prose-gray max-w-none">
                  <p className="text-gray-700 leading-relaxed">
                    {gameDetails.description.replace(/<[^>]*>/g, '').substring(0, 400)}...
                  </p>
                </div>
              </div>
            )}

            {/* Categories */}
            {gameDetails?.categories.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-900">Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {gameDetails.categories.slice(0, 8).map((category, index) => (
                    <span key={index} className="px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 text-sm rounded-full font-medium">
                      {category}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add to collection form */}
            <div className="border-t pt-8">
              <h3 className="text-xl font-bold mb-6 text-gray-900">Add to Your Library</h3>
              
              <div className="space-y-6">
                <div className="flex items-center p-4 bg-gray-50 rounded-2xl">
                  <input
                    type="checkbox"
                    id="wishlist"
                    checked={isWishlist}
                    onChange={(e) => setIsWishlist(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="wishlist" className="ml-3 text-gray-900 font-medium">
                    Add to Wishlist instead of Collection
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Personal Notes
                  </label>
                  <textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 resize-none"
                    rows="3"
                    placeholder="What do you think about this game? Add your personal thoughts..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Custom Tags
                  </label>
                  <input
                    type="text"
                    value={customTags}
                    onChange={(e) => setCustomTags(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                    placeholder="Strategy, Co-op, Family-friendly, Party game..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
                </div>

                <button
                  onClick={handleAddToCollection}
                  disabled={adding}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  {adding ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Adding to {isWishlist ? 'Wishlist' : 'Collection'}...
                    </div>
                  ) : (
                    `Add to ${isWishlist ? 'Wishlist' : 'Collection'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Collection Display Component
const Collection = ({ isWishlist = false, onRefresh }) => {
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_added');

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

  const filteredAndSortedCollection = collection
    .filter(item => 
      item.game.name.toLowerCase().includes(filter.toLowerCase()) ||
      item.custom_tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.game.name.localeCompare(b.game.name);
        case 'rating':
          return (b.game.bgg_rating || 0) - (a.game.bgg_rating || 0);
        case 'year':
          return (b.game.year_published || 0) - (a.game.year_published || 0);
        default:
          return new Date(b.date_added) - new Date(a.date_added);
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your {isWishlist ? 'wishlist' : 'collection'}...</p>
        </div>
      </div>
    );
  }

  if (collection.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-8xl mb-6">🎲</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Your {isWishlist ? 'wishlist' : 'collection'} is empty
        </h3>
        <p className="text-gray-600 text-lg mb-8">
          {isWishlist 
            ? "Start building your wishlist by searching for games you'd love to own!"
            : "Start building your collection by searching for games you love!"
          }
        </p>
        <div className="max-w-md mx-auto bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl">
          <p className="text-sm text-gray-700">
            💡 <strong>Tip:</strong> Use the search tab to find games from BoardGameGeek's massive database and add them to your library.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filters and Sorting */}
      <div className="mb-8 bg-white p-6 rounded-2xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Filter by game name or tags..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            />
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
            >
              <option value="date_added">Date Added</option>
              <option value="name">Name</option>
              <option value="rating">Rating</option>
              <option value="year">Year Published</option>
            </select>
          </div>
        </div>
      </div>

      {/* Collection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredAndSortedCollection.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group">
            <div className="relative">
              {item.game.thumbnail_url ? (
                <img 
                  src={item.game.thumbnail_url} 
                  alt={item.game.name}
                  className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <span className="text-4xl">🎲</span>
                </div>
              )}
              <div className="absolute top-4 right-4">
                {isWishlist ? (
                  <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">Wishlist</span>
                ) : (
                  <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">Owned</span>
                )}
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="font-bold text-lg mb-3 text-gray-900 line-clamp-2">{item.game.name}</h3>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Year:</span>
                  <span className="font-medium">{item.game.year_published || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Players:</span>
                  <span className="font-medium">{item.game.min_players}-{item.game.max_players}</span>
                </div>
                {item.game.bgg_rating && (
                  <div className="flex justify-between items-center">
                    <span>Rating:</span>
                    <div className="flex items-center space-x-1">
                      <StarIcon filled />
                      <span className="font-medium">{item.game.bgg_rating.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {item.custom_tags.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {item.custom_tags.slice(0, 3).map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                    {item.custom_tags.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        +{item.custom_tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {item.user_notes && (
                <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-700 italic">"{item.user_notes}"</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  Added {new Date(item.date_added).toLocaleDateString()}
                </span>
                <button
                  onClick={() => removeFromCollection(item.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors duration-200"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
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
    { id: 'search', label: 'Discover', icon: '🔍', count: null },
    { id: 'collection', label: 'Collection', icon: '📚', count: collectionCount },
    { id: 'wishlist', label: 'Wishlist', icon: '⭐', count: wishlistCount }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 hero-pattern"></div>
        </div>

        <div className="relative container mx-auto px-4 py-24">
          <div className="text-center text-white">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              GameShelf
            </h1>
            <p className="text-xl md:text-3xl mb-8 text-blue-100 max-w-4xl mx-auto leading-relaxed">
              Your personal Steam library for board games. Discover, catalog, and organize your collection with rich BoardGameGeek data.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-blue-200">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🎲</span>
                <span>10,000+ Games</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📊</span>
                <span>Rich Game Data</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🚀</span>
                <span>Instant Search</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-center space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 font-semibold text-sm transition-all duration-200 rounded-t-2xl relative ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-lg -mb-px border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {activeTab === 'search' && (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Find Your Next Adventure</h2>
              <p className="text-xl text-gray-600">Search BoardGameGeek's database of thousands of games</p>
            </div>
            <GameSearch onGameSelect={handleGameSelect} />
            
            {/* Feature highlights */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                <img src="https://images.pexels.com/photos/1422673/pexels-photo-1422673.jpeg" alt="Game Collection" className="w-20 h-20 mx-auto mb-4 rounded-xl object-cover" />
                <h3 className="text-xl font-bold mb-3">Rich Game Data</h3>
                <p className="text-gray-600">Get detailed information from BoardGameGeek including ratings, reviews, and gameplay details.</p>
              </div>
              <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                <img src="https://images.pexels.com/photos/6599547/pexels-photo-6599547.jpeg" alt="Community" className="w-20 h-20 mx-auto mb-4 rounded-xl object-cover" />
                <h3 className="text-xl font-bold mb-3">Personal Collection</h3>
                <p className="text-gray-600">Organize your games with custom tags, personal notes, and easy-to-use filters.</p>
              </div>
              <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                <img src="https://images.unsplash.com/photo-1489850846882-35ef10a4b480?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwxfHxwZW9wbGUlMjBwbGF5aW5nJTIwYm9hcmQlMjBnYW1lc3xlbnwwfHx8fDE3NDg1NjU2ODN8MA&ixlib=rb-4.1.0&q=85" alt="Gameplay" className="w-20 h-20 mx-auto mb-4 rounded-xl object-cover" />
                <h3 className="text-xl font-bold mb-3">Smart Wishlist</h3>
                <p className="text-gray-600">Keep track of games you want to buy and never miss out on your next favorite game.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'collection' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">My Collection</h2>
              <p className="text-xl text-gray-600">Games you own and love</p>
            </div>
            <Collection isWishlist={false} onRefresh={fetchCounts} />
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">My Wishlist</h2>
              <p className="text-xl text-gray-600">Games you're dreaming of adding to your collection</p>
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-24">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">GameShelf</h3>
          <p className="text-gray-400 mb-6">Your digital board game library, powered by BoardGameGeek</p>
          <div className="flex justify-center space-x-8 text-sm text-gray-400">
            <span>🎲 {collectionCount + wishlistCount} Games Tracked</span>
            <span>📚 BGG Integration</span>
            <span>⚡ Instant Search</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;