import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, LayersControl } from 'react-leaflet';
const { BaseLayer } = LayersControl;
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, X, Loader, MapPin, Target } from 'lucide-react';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OpenStreetMapProvider, GeoSearchControl } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import L from 'leaflet';

// Replace the L.icon definitions with custom SVG icons
const createSvgIcon = (color) => {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
  `;

  const svgUrl = `data:image/svg+xml;base64,${btoa(svgTemplate)}`;

  return new Icon({
    iconUrl: svgUrl,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const defaultIcon = createSvgIcon('#2563eb'); // Blue
const highlightedIcon = createSvgIcon('#ef4444'); // Red

L.Marker.prototype.options.icon = defaultIcon;

import PropTypes from 'prop-types';

// Create a new MapEvents component to handle clicks
const MapEvents = ({ onMapClick }) => {
  MapEvents.propTypes = {
    onMapClick: PropTypes.func.isRequired,
  };

  let clickTimeout = null;
  
  useMapEvents({
    click: (e) => {
      // Clear any existing timeout
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
      
      // Set a new timeout
      clickTimeout = setTimeout(() => {
        onMapClick(e);
      }, 300); // 300ms delay to check for double click
    },
    dblclick: () => {
      // Clear the timeout on double click
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }
    }
  });
  return null;
};

const SearchField = () => {
  const map = useMapEvents({});
  
  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: 'bar',
      showMarker: false, // We don't want to show markers for search results
      showPopup: false,
      autoClose: true,
    });
    
    map.addControl(searchControl);
    
    return () => {
      map.removeControl(searchControl);
    };
  }, [map]);

  return null;
};

const MapNotebookApp = () => {
  const [points, setPoints] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPoint, setNewPoint] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [filteredPoints, setFilteredPoints] = useState([]);
  const [map, setMap] = useState(null);
  const [defaultPosition, setDefaultPosition] = useState([51.505, -0.09]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPoint, setEditingPoint] = useState(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');

  // Move filterPoints definition before the effects
  const filterPoints = useCallback(() => {
    const filtered = points.filter(point => {
      const descriptionMatch = point.description.toLowerCase().includes(searchTerm.toLowerCase());
      const tagMatch = point.tags.some(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return descriptionMatch || tagMatch;
    });
    setFilteredPoints(filtered);
  }, [points, searchTerm]);

  // Load points from localStorage
  useEffect(() => {
    const savedPoints = localStorage.getItem('mapPoints');
    if (savedPoints) {
      try {
        const parsedPoints = JSON.parse(savedPoints);
        if (Array.isArray(parsedPoints)) {
          setPoints(parsedPoints);
          setFilteredPoints(parsedPoints);
        }
      } catch (error) {
        localStorage.removeItem('mapPoints');
      }
    }
  }, []);

  // Save points to localStorage
  useEffect(() => {
    if (points.length > 0) {
      localStorage.setItem('mapPoints', JSON.stringify(points));
    }
  }, [points]);

  // Modify the existing filter points effect to separate the concerns
  useEffect(() => {
    filterPoints();
  }, [points, searchTerm, filterPoints]);

  const handleMapClick = (e) => {
    setNewPoint({
      lat: e.latlng.lat,
      lng: e.latlng.lng
    });
  };

  const savePoint = () => {
    if (!description) {
      setShowAlert(true);
      return;
    }

    const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    const point = {
      ...newPoint,
      description,
      tags: tagArray,
      id: Date.now()
    };

    setPoints([...points, point]);
    setNewPoint(null);
    setDescription('');
    setTags('');
    setShowAlert(false);
  };

  const deletePoint = (id, e) => {
    e.stopPropagation(); // Prevent the click event from propagating
    setPoints(points.filter(point => point.id !== id));
  };

  const handleLocationFound = useCallback((e) => {
    if (map) {
      map.setView(e.latlng, 13);
    }
  }, [map]);

  // Move the event listener setup to useEffect
  useEffect(() => {
    if (map) {
      map.on('locationfound', handleLocationFound);
      return () => {
        map.off('locationfound', handleLocationFound);
      };
    }
  }, [map, handleLocationFound]);

  const findMyLocation = () => {
    if (map) {
      map.locate({ setView: true, maxZoom: 16 });
    }
  };

  // Move this effect before the MapContainer render
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDefaultPosition([position.coords.latitude, position.coords.longitude]);
          setIsLoading(false);
        },
        () => {
          setIsLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsLoading(false);
    }
  }, []);

  const updatePoint = (id) => {
    if (!editDescription) {
      setShowAlert(true);
      return;
    }

    const tagArray = editTags.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    setPoints(points.map(point => 
      point.id === id ? {
        ...point,
        description: editDescription,
        tags: tagArray
      } : point
    ));
    
    setEditingPoint(null);
    setEditDescription('');
    setEditTags('');
    setShowAlert(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="p-4 bg-white border-b">
        <div className="flex flex-col gap-4 sm:gap-2">
          <div className="flex items-center justify-center sm:justify-start">
            <div className="flex items-center gap-2 min-w-fit">
              <MapPin className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold whitespace-nowrap">Map Notebook</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Search by description or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-8"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    findMyLocation(); // Call findMyLocation when clearing search
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={findMyLocation}>
              <Target className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-grow relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-2">
              <Loader className="h-8 w-8 animate-spin text-gray-600" />
              <p className="text-gray-600">Loading map...</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={defaultPosition}
            zoom={13}
            className="!absolute inset-0 z-0"
            ref={setMap}
          >
            <MapEvents onMapClick={handleMapClick} />
            <SearchField />
            <LayersControl position="topright">
              <BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
              </BaseLayer>
              
              <BaseLayer name="OpenTopoMap">
                <TileLayer
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                  attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                  maxZoom={17}
                />
              </BaseLayer>

              <BaseLayer name="CyclOSM">
                <TileLayer
                  url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
                  attribution='<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={20}
                />
              </BaseLayer>
            </LayersControl>
            
            {(searchTerm ? filteredPoints : points).map(point => {
              const isMatched = searchTerm && (
                point.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                point.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
              );
              
              return (
                <Marker 
                  key={point.id} 
                  position={[point.lat, point.lng]}
                  icon={isMatched ? highlightedIcon : defaultIcon}
                >
                  <Popup
                    closeButton={false}
                    closeOnClick={false}
                    className="w-[300px]"
                  >
                    <div className="p-2">
                      {editingPoint === point.id ? (
                        <>
                          <div className="flex justify-end mb-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPoint(null);
                              }}
                              className="absolute top-2 right-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            type="text"
                            placeholder="Description"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="mb-2"
                          />
                          <Input
                            type="text"
                            placeholder="Tags (comma-separated)"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            className="mb-2"
                          />
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              updatePoint(point.id);
                            }}
                            className="w-full mb-2"
                          >
                            Save Changes
                          </Button>
                          {showAlert && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertDescription>
                                Please add a description
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-end mb-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                map.closePopup();
                              }}
                              className="absolute top-2 right-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="mb-2">{point.description}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {point.tags.map(tag => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPoint(point.id);
                                setEditDescription(point.description);
                                setEditTags(point.tags.join(', '));
                              }}
                              className="flex-1"
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="destructive"
                              size="sm"
                              onClick={(e) => deletePoint(point.id, e)}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {newPoint && (
              <Marker position={[newPoint.lat, newPoint.lng]}>
                <Popup
                  closeButton={false}
                  closeOnClick={false}
                  className="w-[300px]"
                >
                  <div className="p-2">
                    <div className="flex justify-end mb-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewPoint(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      type="text"
                      placeholder="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mb-2"
                    />
                    <Input
                      type="text"
                      placeholder="Tags (comma-separated)"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="mb-2"
                    />
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        savePoint();
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Save Point
                    </Button>
                    {showAlert && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertDescription>
                          Please add a description
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default MapNotebookApp;