define(['components/user-interface', 'components/input/text-input'], function (UserInterface, TextInput) {
  class MapRoute extends UserInterface {
    constructor(container, map, from, to, tripLength = null) {
      super(container);
      this.container = container;
      this.map = map;
      this.from = from;
      this.to = to;
      this.result = null;
      this.markers = [];

      if (tripLength) {
        this.tripLength = new TextInput(tripLength.parent().parent(), tripLength);
      }

      // Initialize OpenStreetMap route layer
      this.routeLayer = L.layerGroup().addTo(this.map);

      // Initialize geocoder with better error handling
      this.geocoder = new GeoSearch.OpenStreetMapProvider({
        params: {
          'accept-language': 'en', // Ensure English results
          countrycodes: 'in'       // Focus on India
        }
      });

      // Initialize routing control
      this.routingControl = L.Routing.control({
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          profile: 'driving'
        }),
        showAlternatives: true,
        fitSelectedRoutes: true,
        show: false, // Hide default UI
        lineOptions: {
          styles: [
            { color: '#3388ff', opacity: 0.8, weight: 6 },
            { color: '#ffffff', opacity: 0.3, weight: 4 }
          ]
        }
      }).addTo(this.map);

      // Set up event listeners
      this.setupEventListeners();

      // Enable map clicking
      this.setupMapClicking();
    }

    setupEventListeners() {
      // Handle input changes
      this.from.on('input', _.debounce(() => this.handleSearchInput(this.from), 300));
      this.to.on('input', _.debounce(() => this.handleSearchInput(this.to), 300));

      // Handle route updates
      this.routingControl.on('routesfound', (e) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          this.handleRouteFound(routes[0]);
        }
      });
    }

    setupMapClicking() {
      // Add click handler to map
      this.map.on('click', (e) => {
        const latlng = e.latlng;

        // If no input is focused, return
        if (!this.activeInput) return;

        // Reverse geocode the clicked location
        this.reverseGeocode(latlng).then(address => {
          if (address) {
            this.activeInput.val(address);
            this.updateRoute();
          }
        });
      });

      // Track which input is active
      this.from.focus(() => this.activeInput = this.from);
      this.to.focus(() => this.activeInput = this.to);
      this.from.blur(() => this.activeInput = null);
      this.to.blur(() => this.activeInput = null);
    }

    async handleSearchInput(input) {
      const query = input.val().trim();
      if (query.length < 3) {
        input.parent().find('.search-results').remove();
        return;
      }

      try {
        const results = await this.geocoder.search({ query });
        this.showSearchResults(input, results);
      } catch (error) {
        console.error('Geocoding error:', error);
        this.setError('Location search failed. Please try again.');
      }
    }

    showSearchResults(input, results) {
      // Remove existing results
      input.parent().find('.search-results').remove();

      // Create results container
      const resultsDiv = $('<div>').addClass('search-results');

      results.slice(0, 5).forEach(result => {
        const resultItem = $('<div>')
          .addClass('search-result')
          .text(result.label)
          .on('click', () => {
            // Just update input text first
            input.val(result.label);
            resultsDiv.remove();

            // Then update marker and coordinates
            this.handleLocationSelect(input, result);
          });
        resultsDiv.append(resultItem);
      });

      input.parent().append(resultsDiv);
    }

    async handleLocationSelect(input, result) {
      const coord = L.latLng(result.y, result.x);
      const isFromInput = input === this.from;

      // Create or update result structure
      if (!this.result) {
        this.result = {
          routes: [{
            legs: [{
              start_address: '',
              end_address: '',
              start_location: null,
              end_location: null
            }]
          }]
        };
      }

      // Update coordinates in result
      if (isFromInput) {
        this.result.routes[0].legs[0].start_location = {
          lat: result.y,
          lng: result.x
        };
        this.result.routes[0].legs[0].start_address = result.label;
      } else {
        this.result.routes[0].legs[0].end_location = {
          lat: result.y,
          lng: result.x
        };
        this.result.routes[0].legs[0].end_address = result.label;
      }

      // Update markers
      if (isFromInput) {
        // Remove existing 'from' marker if it exists
        if (this.markers[0]) {
          this.markers[0].remove();
          this.markers.shift();
        }

        // Create new marker
        const marker = L.marker(coord, { draggable: true })
          .addTo(this.map)
          .bindPopup('Start');

        // Handle marker drag
        marker.on('dragend', async (e) => {
          const latlng = e.target.getLatLng();
          try {
            const results = await this.geocoder.search({
              query: `${latlng.lat}, ${latlng.lng}`
            });

            if (results && results.length > 0) {
              // Update input and coordinates
              this.from.val(results[0].label);
              this.result.routes[0].legs[0].start_location = {
                lat: results[0].y,
                lng: results[0].x
              };
              this.result.routes[0].legs[0].start_address = results[0].label;

              // Update route if both points exist
              if (this.markers.length === 2) {
                this.updateRouteDisplay();
              }
            } else {
              this.setError('No valid location found');
              e.target.setLatLng(coord);
            }
          } catch (error) {
            console.error('Location update error:', error);
            this.setError('Failed to update location');
            e.target.setLatLng(coord);
          }
        });

        this.markers.unshift(marker);
      } else {
        // Remove existing 'to' marker if it exists
        if (this.markers[1]) {
          this.markers[1].remove();
          this.markers.pop();
        }

        // Create new marker
        const marker = L.marker(coord, { draggable: true })
          .addTo(this.map)
          .bindPopup('End');

        // Handle marker drag
        marker.on('dragend', async (e) => {
          const latlng = e.target.getLatLng();
          try {
            const results = await this.geocoder.search({
              query: `${latlng.lat}, ${latlng.lng}`
            });

            if (results && results.length > 0) {
              // Update input and coordinates
              this.to.val(results[0].label);
              this.result.routes[0].legs[0].end_location = {
                lat: results[0].y,
                lng: results[0].x
              };
              this.result.routes[0].legs[0].end_address = results[0].label;

              // Update route if both points exist
              if (this.markers.length === 2) {
                this.updateRouteDisplay();
              }
            } else {
              this.setError('No valid location found');
              e.target.setLatLng(coord);
            }
          } catch (error) {
            console.error('Location update error:', error);
            this.setError('Failed to update location');
            e.target.setLatLng(coord);
          }
        });

        // Add to markers array
        if (this.markers.length === 0) {
          this.markers.push(null, marker);
        } else {
          this.markers[1] = marker;
        }
      }

      // Update route if both locations are set
      if (this.markers.length === 2) {
        this.updateRouteDisplay();
      }
    }

    updateRouteDisplay() {
      if (this.markers.length !== 2) return;

      const fromCoord = this.markers[0].getLatLng();
      const toCoord = this.markers[1].getLatLng();

      // Update routing control
      this.routingControl.setWaypoints([fromCoord, toCoord]);

      // Fit bounds to show both markers
      const bounds = L.latLngBounds([fromCoord, toCoord]);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    async reverseGeocode(latlng) {
      try {
        const results = await this.geocoder.search({
          query: `${latlng.lat}, ${latlng.lng}`
        });
        return results.length > 0 ? results[0].label : null;
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        this.setError('Failed to get address for clicked location');
        return null;
      }
    }

    async updateRoute() {
      const from = this.from.val().trim();
      const to = this.to.val().trim();

      if (!from || !to) return;

      try {
        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        let fromCoord, toCoord;

        // Use coordinates from result if available
        if (this.result && this.result.routes[0].legs[0].start_location) {
          fromCoord = L.latLng(
            this.result.routes[0].legs[0].start_location.lat,
            this.result.routes[0].legs[0].start_location.lng
          );
        } else {
          // Geocode from input text
          const fromResults = await this.geocoder.search({ query: from });
          if (!fromResults.length) {
            this.setError('Start location not found');
            return;
          }
          fromCoord = L.latLng(fromResults[0].y, fromResults[0].x);
        }

        if (this.result && this.result.routes[0].legs[0].end_location) {
          toCoord = L.latLng(
            this.result.routes[0].legs[0].end_location.lat,
            this.result.routes[0].legs[0].end_location.lng
          );
        } else {
          // Geocode from input text
          const toResults = await this.geocoder.search({ query: to });
          if (!toResults.length) {
            this.setError('End location not found');
            return;
          }
          toCoord = L.latLng(toResults[0].y, toResults[0].x);
        }

        // Add markers
        this.markers.push(
          L.marker(fromCoord).addTo(this.map).bindPopup('Start'),
          L.marker(toCoord).addTo(this.map).bindPopup('End')
        );

        // Update routing control
        this.routingControl.setWaypoints([fromCoord, toCoord]);

        // Fit bounds to show both markers
        const bounds = L.latLngBounds([fromCoord, toCoord]);
        this.map.fitBounds(bounds, { padding: [50, 50] });

        this.removeError();

      } catch (error) {
        console.error('Route calculation error:', error);
        this.setError('Failed to calculate route. Please try different locations.');
      }
    }

    handleRouteFound(route) {
      if (!route || !route.coordinates) return;

      const duration = Math.round(route.summary.totalTime / 60);
      const durationText = duration > 60
        ? `${Math.floor(duration / 60)} hours ${duration % 60} mins`
        : `${duration} mins`;

      if (this.tripLength) {
        this.tripLength.setValue(durationText);
      }

      // Only update the duration in the result
      if (this.result) {
        this.result.routes[0].legs[0].duration = { text: durationText };
      }
    }

    toJson() {
      if (!this.result) {
        this.setError('Please select a valid route first.');
        return null;
      }

      const route = this.result.routes[0];
      const leg = route.legs[0];

      const origin = {
        address: leg.start_address,
        lat: leg.start_location.lat,
        lon: leg.start_location.lng
      };

      const destination = {
        address: leg.end_address,
        lat: leg.end_location.lat,
        lon: leg.end_location.lng
      };

      const json = { origin, destination };

      if (this.tripLength) {
        const length = this.tripLength.getValue();
        if (!length) return null;
        json.trip_length = length;
      }

      this.removeError();
      return json;
    }
  }

  return MapRoute;
});