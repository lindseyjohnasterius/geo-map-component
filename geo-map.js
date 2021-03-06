/*

    **** BEGIN ASCII ART ****

       ________________        __  ______    ____
      / ____/ ____/ __ \      /  |/  /   |  / __ \
     / / __/ __/ / / / /_____/ /|_/ / /| | / /_/ /
    / /_/ / /___/ /_/ /_____/ /  / / ___ |/ ____/
    \____/_____/\____/     /_/  /_/_/  |_/_/


    **** END ASCII ART ****

    Markup Based Map as a pure Web Component

*/



/*
  
  ROUTING
  
  Get and Set URL

*/

function getURLValues(URL = window.location.href ){
  const search_params = new URLSearchParams(URL)
  let options = {}
  for (const [key, unparsed_value] of search_params) {
    if(key !== window.location.origin + window.location.pathname + '?' ){
      try {
        const value = JSON.parse(decodeURI(unparsed_value))
        options[key] = value
      } catch {
        options[key] = decodeURI(unparsed_value)
      }
    }
  }
  return options
}

function setURLValues(obj){
  let url = window.location.origin + window.location.pathname + '?'
  Object.keys(obj).forEach(key => {
    let encodedvalue = encodeURI(obj[key])
    url += `&${key}=${encodedvalue}`
  })
  history.pushState(obj, '', url)
}

class GeoMap extends HTMLElement {
  connectedCallback(){
    if(typeof(mapboxgl) === 'undefined'){
      this.innerHTML = '<error>STORY MAP REQUIRES MAPBOXGL TO WORK: https://docs.mapbox.com/mapbox-gl-js/api/</error>'
    }
    const URLvalues = getURLValues()
  
    this.access_token = this.getAttribute('accesstoken')
    if(this.access_token === null){
      const access_token_error = `
        Error: Story Map requires a Mapbox access token. 
        Please consult the readme for more information`
      this.innerHTML = `<error> ${access_token_error} </error>`
      return new Error(access_token_error)
    }
    this.removeAttribute('accesstoken')
    mapboxgl.accessToken = this.access_token

    // Initial Location, set in Map Attributes

    this.latitude = this.getAttribute('latitude')
    if(this.latitude === null) this.latitude = 0
    this.latitude = URLvalues.latitude ? URLvalues.latitude : this.latitude

    this.longitude = this.getAttribute('longitude')
    if(this.longitude === null) this.longitude = 0
    this.longitude = URLvalues.longitude ? URLvalues.longitude : this.longitude

    this.zoom = this.getAttribute('zoom')
    if(this.zoom === null) this.zoom = 1
    this.zoom = URLvalues.zoom ? URLvalues.zoom : this.zoom

    this.bearing = this.getAttribute('bearing')
    if(this.bearing === null) this.bearing = 0
    this.bearing = URLvalues.bearing ? URLvalues.bearing : this.bearing

    this.pitch = this.getAttribute('pitch')
    if(this.pitch === null) this.pitch = 0
    this.pitch = URLvalues.pitch ? URLvalues.pitch : this.pitch

    this.popups = this.getAttribute('popups')
    if(this.popups === null){
      this.popups = false} 
    else {
      this.popups = true
    }

    this.orbit = this.getAttribute('orbit')
    if(this.orbit === null){
      this.orbit = false
    } else {
      this.orbit = true
    }

    this.no_sky = this.getAttribute('no-sky')
    if(this.no_sky === null){
      this.no_sky = false
    } else {
      this.no_sky = true
    }

    this.home_coord = {
      center:[this.longitude, this.latitude],
      zoom:this.zoom,
      pitch: this.pitch,
      bearing: this.bearing
    }
    this.styleurl = this.getAttribute('styleurl')
    if(this.styleurl === null || this.styleurl === ""){
      console.warn('could not find style url, using the default')
      this.styleurl = 'mapbox://styles/mapbox/streets-v11'
    }
    this.removeAttribute('styleurl')

    this.locked = this.getAttribute('locked')
    if(this.locked === null){
      this.locked = false
    } else {
      this.locked = true
    }

    const el = document.createElement('div')
    el.classList.add('map-container')
    this.appendChild(el)
    this.map = new mapboxgl.Map({
      container: el, // container ID
      style: this.styleurl, // style URL
      center: [this.longitude, this.latitude],
      zoom: this.zoom,
      bearing: this.bearing,
      pitch: this.pitch,
      style: this.styleurl,
      interactive: !this.locked
    })

    this.geocoder = this.getAttribute('geocoder')
    if(this.geocoder !== null){   
      if(typeof(MapboxGeocoder) === 'undefined'){
        this.innerHTML = `If you would like to use the geocoder element, 
        you must include the geocoder plugin in your HTML: 
        https://docs.mapbox.com/mapbox-gl-js/example/mapbox-gl-geocoder/`
        return
      } 
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        zoom: 18,
        marker: false,
        placeholder: 'Search for an Address'
      })
      geocoder.on('result', (e) => { this.geocoderResult(e) })
      this.map.addControl( geocoder )
    } // end GeoCoder
    this.geolocate = this.getAttribute('geolocate')
    if(this.geolocate !== null){
      this.map.addControl(new mapboxgl.GeolocateControl({
        showAccuracy: false,
        showUserLocation: false
      }))
    }

    this.flyHomeButton = this.getAttribute('flyhome')
    if(this.flyHomeButton !== null){
      this.map.addControl(new FlyHomeController(this.flyHome))
      this.addEventListener('FLY HOME', (e) => {
        this.flyHome()
      })
    }

    this.navigation_control = this.getAttribute('navigation')
    if(this.navigation_control !== null){
      this.map.addControl(
        new mapboxgl.NavigationControl({visualizePitch: true})
      )
    }

    this.slideshow = this.getAttribute('slideshow')
    if(this.slideshow !== null){
      this.map.addControl(new SlideShowControls(this.map))
      this.addEventListener('NEXT SLIDE', (e) => { this.nextLocation() })
      this.addEventListener('PREV SLIDE', (e) => { this.prevLocation() })
      this.addEventListener('SHOW HOME', (e) => {
        this.selectLocation(this.querySelector('map-location'))
      })
      this.slideshow_index = 0
    }

    this.edit_mode = this.getAttribute('edit')
    if(this.edit_mode !== null){
      this.map.addControl(new EditController(this.map))
    }

    this.map.on('load', () => {this.mapLoaded()})
  }

  nextLocation(){
    const locations = [...this.querySelectorAll('map-location')]
    this.slideshow_index++
    if(this.slideshow_index > locations.length - 1) this.slideshow_index = 0 
    this.selectLocation(locations[this.slideshow_index])
  }

  prevLocation(){
    const locations = [...this.querySelectorAll('map-location')]
    this.slideshow_index--
    if(this.slideshow_index < 0) this.slideshow_index = locations.length  - 1
    this.selectLocation(locations[this.slideshow_index])
  }

  getNewID() {
    return 'dtrm-xxxxxxxxxxxxxxxx-'
      .replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16)
    }) + Date.now()
  }

  async handleDOMUpdates(mo = {}){
    const query = this.querySelectorAll('map-location')
    if(query.length !== this.storyLocationCount){
      this.cursor = 'wait'
      this.storyLocationCount = query.length
      await [...query].forEach(location => { const addedMarkers = this.addLocation(location) })
      this.cursor = ''
    }
  }

  addLocation(location){
    const center = [location.longitude, location.latitude]
    let markers = [...location.querySelectorAll('map-marker')]
    if(markers.length > 0){
      markers = markers.map(marker => {
        let rotation_alignment = marker.getAttribute('rotation-alignment')
        if(rotation_alignment === null){
          rotation_alignment = 'viewport'
        }
        return new mapboxgl.Marker({
          draggable:false,
          scale:0,
          rotationAlignment: rotation_alignment,
          element: marker
        }).setLngLat(center)
          .addTo(this.map)
      })
    } else {
      markers[0] = new mapboxgl.Marker({
        draggable: false,
        rotationAlignment: 'viewport',
        scale: 1,
      }).setLngLat(center)
      .addTo(this.map)
    }
    markers.forEach(marker => {
      marker.getElement().addEventListener('click', (e)=> {
        e.stopPropagation()
        this.selectLocation(location)
      })
    })

    location.addEventListener('LOCATION UPDATED', function(e){
      const longitude = location.getAttribute('longitude')
      const latitude = location.getAttribute('latitude')
      markers.forEach(marker => {
        marker.setLngLat([longitude, latitude])
      })
    })

    location.addEventListener('LOCATION REMOVED', function(e){
      markers.forEach(marker => {
        marker.remove()
      })
    })
  }

  selectLocation(location){
    if(location === undefined) return
    if(this.orbiting){
      this.stopOrbit()
    }
    const center = [location.longitude, location.latitude]
    this.map.flyTo({
      center,
      zoom: location.zoom,
      bearing: location.bearing,
      pitch: location.pitch
    })
    ;[...document.querySelectorAll('map-information-box')].forEach(box => box.remove())

    if(this.popups){
      return
    } else {
      const info_box = document.createElement('map-information-box')
      info_box.innerHTML = location.innerHTML
      this.appendChild(info_box)
    }
  }

  setZoomClass(){
    if(this.zoom < 10){
      this.classList.add('far')
      this.classList.remove('middle')
      this.classList.remove('near')
    } else if(this.zoom >= 10 && this.zoom <= 15){
      this.classList.add('middle')
      this.classList.remove('far')
      this.classList.remove('near')
    } else {
      this.classList.add('near')
      this.classList.remove('middle')
      this.classList.remove('far')
    }
  }

  mapLoaded(){
    this.map.addSource('mapbox-terrain', {
      'type': 'raster-dem',
      'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
      'tileSize': 512,
      'maxzoom': 20
    })

    this.map.setTerrain({ 
      'source': 'mapbox-terrain' ,
      'exaggeration': 1
    })      
    

    if(this.no_sky){
      this.map.addLayer({
        'id':'sky',
        'type':'sky',
        'paint': {
          'sky-type':'gradient',
          'sky-gradient':[
            'interpolate',
            ['linear'],
            ['sky-radial-progress'],
            0.8,
            '#040810',
            1,
            '#040810'
          ]
        }
      })

    } else {
      this.map.addLayer({
        'id': 'sky',
        'type': 'sky',
        'paint': {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15
        }
      })

    }

    const first_pos = {
      latitude: this.latitude, 
      longitude: this.longitude,
      zoom: this.zoom,
      bearing: this.bearing, 
      pitch: this.pitch,
    }

    this.setZoomClass()


    this.map.on('moveend', (e) => {
      if(this.orbiting) return
      let center  = this.map.getCenter()
      this.longitude = center.lng
      this.latitude = center.lat
      this.zoom = this.map.getZoom()
      this.bearing = this.map.getBearing()
      this.pitch = this.map.getPitch()

      this.setZoomClass()

      const new_pos = {
        latitude: this.latitude, 
        longitude: this.longitude,
        zoom: this.zoom,
        bearing: this.bearing, 
        pitch: this.pitch,
      }


      setURLValues(new_pos)
    })//end moveend


    const config = { attributes: true, childList: true, subtree: true }
    const observer = new MutationObserver((mo) => {this.handleDOMUpdates(mo)})
    observer.observe(this, config)

    const map_images = [...this.querySelectorAll('map-image')]
    map_images.forEach(img => {
      this.addImage(img)
    })

    const map_videos = [...this.querySelectorAll('map-video')]
    map_videos.forEach(video => {
      this.addVideo(video)
    })

    const map_edges = [...this.querySelectorAll('map-edge')]
    map_edges.forEach(edge => {
      this.addEdge(edge)
    })


    if(this.orbit){
      document.body.addEventListener('mousemove', () => {
        this.stopOrbit()
        this.orbit_countdown = setTimeout(()=>this.beginOrbit(), 10000)
      })
      this.orbit_countdown = setTimeout(()=>this.beginOrbit(), 5000)
    }


    // add loaded event here
    this.dispatchEvent(new CustomEvent('MAP LOADED'))
    this.map_loaded = true

  }

  beginOrbit(){
    this.orbiting = true
    const rotateCamera = (timestamp) => {
      this.map.rotateTo((timestamp / 1000) % 360, {duration: 0})
      if(!this.orbiting){
        return
      } else {
        requestAnimationFrame(rotateCamera)

      }
    }

    const bearing = this.map.getBearing()

    rotateCamera(bearing * 1000)
  }

  stopOrbit(){
    clearInterval(this.orbit_countdown)
    this.orbiting = false
  }

  addVideo(video_el){

    const video_id = this.getNewID()
    const layer_id = this.getNewID()

    const video_src = video_el.getAttribute('src')

    const north_west_edge_el = video_el.querySelector('north-west-corner')
    const north_west_edge = [parseFloat(north_west_edge_el.getAttribute('longitude')), parseFloat(north_west_edge_el.getAttribute('latitude'))]

    const north_east_edge_el = video_el.querySelector('north-east-corner')
    const north_east_edge = [parseFloat(north_east_edge_el.getAttribute('longitude')), parseFloat(north_east_edge_el.getAttribute('latitude'))]

    const south_east_edge_el = video_el.querySelector('south-east-corner')
    const south_east_edge = [parseFloat(south_east_edge_el.getAttribute('longitude')), parseFloat(south_east_edge_el.getAttribute('latitude'))]

    const south_west_edge_el = video_el.querySelector('south-west-corner')
    const south_west_edge = [parseFloat(south_west_edge_el.getAttribute('longitude')), parseFloat(south_west_edge_el.getAttribute('latitude'))]

    this.map.addSource(video_id, {
      'type': 'video',
      'urls': [video_src],
      'coordinates': [
      north_west_edge,
      north_east_edge,
      south_east_edge,
      south_west_edge
      ]
      });
    this.map.addLayer({
      id: layer_id,
      'type': 'raster',
      'source': video_id,

    }, "Reflectivity")

    this.map.setPaintProperty(
      layer_id, 'raster-opacity',1
    )

    const videoSource = this.map.getSource(video_id);
    videoSource.play();

  }

  addEdge(edge){
    const {MapboxLayer, ScatterplotLayer, ArcLayer} = deck;
    const source_id = edge.getAttribute('source')
    const target_id = edge.getAttribute('target')
    const source_el = document.querySelector(`#${source_id}`)
    const target_el = document.querySelector(`#${target_id}`)
    const source_longitude = parseFloat(source_el.getAttribute('longitude'))
    const source_latitude = parseFloat(source_el.getAttribute('latitude'))
    const target_longitude = parseFloat(target_el.getAttribute('longitude'))
    const target_latitude = parseFloat(target_el.getAttribute('latitude'))

    const edge_id = this.getNewID()
    this.map.addLayer(new MapboxLayer({
      id: edge_id,
      type: ArcLayer,
      data: [
        {source: [source_longitude, source_latitude], target: [target_longitude, target_latitude]}
      ],
      getSourcePosition: d => d.source,
      getTargetPosition: d => d.target,
      getSourceColor: [255, 255, 255],
      getTargetColor: [255, 255, 255],
      getWidth: 4
    }))
  }

  addImage(image_el){

    const img_id = this.getNewID()
    const layer_id = this.getNewID()

    const img_src = image_el.getAttribute('src')

    const north_west_edge_el = image_el.querySelector('north-west-corner')
    const north_west_edge = [parseFloat(north_west_edge_el.getAttribute('longitude')), parseFloat(north_west_edge_el.getAttribute('latitude'))]

    const north_east_edge_el = image_el.querySelector('north-east-corner')
    const north_east_edge = [parseFloat(north_east_edge_el.getAttribute('longitude')), parseFloat(north_east_edge_el.getAttribute('latitude'))]

    const south_east_edge_el = image_el.querySelector('south-east-corner')
    const south_east_edge = [parseFloat(south_east_edge_el.getAttribute('longitude')), parseFloat(south_east_edge_el.getAttribute('latitude'))]

    const south_west_edge_el = image_el.querySelector('south-west-corner')
    const south_west_edge = [parseFloat(south_west_edge_el.getAttribute('longitude')), parseFloat(south_west_edge_el.getAttribute('latitude'))]

    console.log(north_west_edge, north_east_edge, south_west_edge, south_east_edge)
    this.map.addSource(img_id, {
      'type': 'image',
      'url': img_src,
      'coordinates': [
      north_west_edge,
      north_east_edge,
      south_east_edge,
      south_west_edge
      ]
      });
    this.map.addLayer({
      id: layer_id,
      'type': 'raster',
      'source': img_id,
      'paint': {
      'raster-fade-duration': 0
      }
    })
  }

  geocoderResult(){
    this.map.once('moveend', async (e) => {
      console.log(e)
    })
  }

  static get observedAttributes() {
    return [];
  }

  attributeChangedCallback(name, old_value, new_value){
    switch(name){
      default:
    }
  }
}

customElements.define('geo-map', GeoMap)


class MapLocation extends HTMLElement {
  connectedCallback(){
    this.latitude = this.getAttribute('latitude')
    if(this.latitude === null){
      const latitude_error = `
        Error: Story Locations require a latitude value. 
        Please consult the readme for more information`
      this.innerHTML = `<error> ${latitude_error} </error>`
      return new Error(latitude_error)
    }

    this.longitude = this.getAttribute('longitude')
    if(this.longitude === null){
      const longitude_error = `
      Error: Story Locations require a longitude value. 
        Please consult the readme for more information`
      this.innerHTML = `<error> ${longitude_error} </error>`
      return new Error(longitude_error)
    }

    this.zoom = this.getAttribute('zoom')
    if(this.zoom === null){
      const zoom_error = `Error: Story Locations require a zoom value. 
        Please consult the readme for more information`
      this.innerHTML = `<error> ${zoom_error} </error>`
      return new Error(zoom_error)
    }

    this.bearing = this.getAttribute('bearing')
    if(this.bearing === null || this.bearing === ""){
      console.warn('Could not find bearings, using the default')
      this.bearing = 80
    }

    this.pitch = this.getAttribute('pitch')
    if(this.pitch === null || this.pitch === ""){
      console.warn('Could not find pitch, using the default')
      this.pitch = 60
    }

    this.duration = this.getAttribute('duration')
  }

  static get observedAttributes() {
    return ['latitude','longitude','zoom','bearing','pitch'];
  }

  disconnectedCallback(){
    this.dispatchEvent(new CustomEvent('LOCATION REMOVED'))
  }

  attributeChangedCallback(name, old_value, new_value){
    switch(name){
      case "latitude":
      case "longitude":
      case "zoom":
      case "bearing":
      case "pitch":
        this.dispatchEvent(new CustomEvent('LOCATION UPDATED'))
        break
      default:
        console.warn('do not know how to handle a change in attribute', name)
    }

    this.dispatchEvent(new CustomEvent('LOCATION UPDATED'))
  }
}

customElements.define('map-location', MapLocation)


class LocationEditInfoWidth extends HTMLElement {
  connectedCallback(){
    this.innerHTML = `
    <details>
    <form>
      <input id="location-title" placeholder="title">
      <details>
        <summary>Location Body</summary>
        <textarea id="location-body">
        </textarea>
      </details>
      <details>
        <summary>Results (copy and paste)</summary>
        <textarea id="result"></textarea>
      </details>
    </form>

    </details>
    `
  }

}

customElements.define('map-editor-widget', LocationEditInfoWidth)

/*
  
  EDIT CONTROLLER
  
*/

class EditController {
  onAdd(map) {
    this.map = map
    this.cursor = document.createElement('div')
    this.cursor.innerHTML = '+'
    this.cursor.style.position="absolute"
    this.cursor.style.left="50%"
    this.cursor.style.top="50%"
    this.cursor.style.transform = "translate(-50%, -50%) scale(5)"
    this.cursor.style.pointerEvents = 'none'
    this.cursor.style.zIndex = '1000'
    document.querySelector('geo-map').appendChild(this.cursor)
    this.editwidget = document.createElement('map-editor-widget')
    document.body.appendChild(this.editwidget)
    this._container = document.createElement('div')
    this._container.classList = 'mapboxgl-ctrl mapboxgl-ctrl-group'
    this.edit_button = document.createElement('button')
    this.edit_button.innerHTML = `<svg height='16px' width='16px'  fill="#000000" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 100 100" style="enable-background:new 0 0 100 100;" xml:space="preserve"><g><g><path d="M80.4,5.5h-2.8L66.8,16.3l17,17l10.8-10.8v-2.8L80.4,5.5z M12.8,70.3L5,95l24.7-7.8l47-47l-17-17L12.8,70.3z"></path></g></g></svg>`
    this.edit_button.addEventListener('click', (e) => {this.handleClick(e)})
    this._container.appendChild(this.edit_button)
    return this._container;
  }

  handleClick(e){
    const center = this.map.getCenter()
    const new_marker = document.createElement('map-location')
    const location = getURLValues()
    Object.keys(location).forEach(key => {
      new_marker.setAttribute(key, location[key])
    })
    document.querySelector('geo-map').appendChild(new_marker)

    const title = this.editwidget.querySelector('#location-title').value
    const body = this.editwidget.querySelector('#location-body').value


    const new_story_location_markup = 

      `<map-location
        latitude="${location.latitude}"
        longitude="${location.longitude}"
        zoom="${location.zoom}"
        pitch="${location.pitch}"
        bearing="${location.bearing}"
        title="${title}"
      >
        ${body.toString()}
      </map-location>`

    // @todo  
    const new_story_location_geojson = JSON.stringify({
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {},
          "geometry": {
            "type": "Point",
            "coordinates":[center.lng, center.lat]
          }
        }
      ]
    })

    this.editwidget.querySelector('#result').value += new_story_location_markup

    console.log(new_story_location_markup, new_story_location_geojson)
  }
 
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

const world_svg = `<svg style="margin-top: 0.5em;"  height='1.25em' width='1.25em'  fill="#1A1A1A" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 24 24" enable-background="new 0 0 24 24" xml:space="preserve"><g><path d="M12,0.133C5.446,0.133,0.133,5.446,0.133,12S5.446,23.867,12,23.867c6.554,0,11.867-5.313,11.867-11.867   S18.554,0.133,12,0.133z M14.365,4.76h0.02l0.015-0.001l0.034,0.005l-0.011-0.012c0.006-0.006-0.024-0.008,0.005-0.013   c0.029-0.006-0.001-0.015,0.033-0.015c0.017,0,0.038-0.001,0.056-0.004c0.018-0.002,0.035-0.004,0.046-0.003   c-0.026-0.004-0.036,0.003-0.029-0.012l-0.007-0.001c-0.014,0.013-0.034,0.021-0.051,0.016c-0.016-0.004-0.019,0.002-0.041,0.002   c-0.022,0-0.022,0.001,0.005-0.01c0.025-0.01,0.011-0.018,0.023-0.012l0.022-0.025l0-0.01c0.014-0.01,0.008-0.016,0.039-0.015   c0.029,0.001,0.027-0.016,0.003-0.016c-0.024,0-0.064,0.008-0.059-0.002l-0.013-0.013l-0.02-0.005l-0.006-0.01   c-0.015,0.005-0.037-0.001-0.02-0.006c0.017-0.004-0.016-0.014,0.005-0.016l0.023,0l0.009-0.003   c-0.01-0.008-0.017-0.022,0.011-0.022c0.029,0,0.027-0.012,0.007-0.014c-0.02,0-0.031,0.001-0.035-0.007l-0.019-0.011   c0.011-0.003,0.023-0.006,0.042,0.005l-0.012-0.03V4.488l0.013-0.001l0.017-0.002l0.055,0.012l0.022,0.003l0.012-0.004   c0.033,0.005,0.02,0.009,0.036,0.015c0.016,0.005-0.02-0.019,0-0.025c0.023-0.008,0.036-0.005,0.037-0.017   c0.002-0.012,0.033-0.017,0.009-0.012c-0.026,0.004-0.038,0.006-0.05-0.006c-0.011-0.011-0.024-0.011-0.001-0.013   c0.023-0.002,0.004-0.01,0.024-0.013c0.021-0.004-0.006-0.012,0.013-0.021c0.018-0.01,0.006-0.029,0.021-0.022l0.02-0.001   l0.018-0.001l0.014-0.005l0.013-0.005c0.008,0.009,0.022,0.022,0.006,0.035c0.027-0.02,0.006-0.034,0.016-0.035   c0.016-0.002,0.01-0.013,0.031,0c0.022,0.012,0.036,0.012,0.014,0.018c-0.022,0.007-0.04,0.013-0.028,0.013l0.037-0.005   c0.01-0.008,0.024-0.007,0.043-0.012l0.032,0.002l0.016,0.003l0.012,0.02l0.008,0.016l0.017,0.016l-0.005,0.016l-0.016,0.015   l0.021-0.007l0.025,0.009l-0.002,0.033l-0.029,0.017l-0.016,0.007l-0.024,0.015L14.868,4.55l-0.014,0.002   c-0.022-0.005-0.02,0.013-0.009,0.016l0.011,0.021c-0.002,0.009,0.029,0.027,0.013,0.027c-0.015,0.001,0.012,0.018-0.007,0.019   c-0.02,0.002,0.012,0.018,0.01,0.027l-0.003,0.032l-0.002,0.028c-0.015,0.011,0.009,0.013-0.009,0.025   C14.84,4.76,14.845,4.765,14.834,4.77c-0.011,0.007,0.016,0.028-0.001,0.027H14.82l-0.026-0.009l-0.023,0.004l-0.013,0.004   l0.001-0.04l-0.011,0.039c-0.003-0.004-0.014-0.003-0.039-0.002c-0.025,0.001-0.012,0.01-0.031,0.01l-0.012,0.007l-0.018,0.007   L14.63,4.827l-0.019,0.009l-0.025,0.008l-0.023,0.009l-0.017,0.004l-0.02,0.003l-0.034,0.005L14.47,4.87   c-0.014-0.009-0.039-0.004-0.055,0.001l-0.002-0.007l0.005-0.008l0.022-0.009l0.014-0.009L14.432,4.84l-0.032,0.005   c-0.02,0.009-0.041,0.002-0.016-0.007c0.026-0.009,0.063-0.023,0.063-0.023s-0.031,0.002-0.054,0.011   c-0.016,0.006-0.021,0.002-0.023-0.003l-0.008-0.005c-0.012,0.004-0.038-0.003-0.012-0.015c0.026-0.01,0.042-0.01,0.055-0.016   l0.029-0.009c0,0-0.036-0.003-0.053,0.001h-0.019l-0.018-0.001C14.325,4.785,14.347,4.763,14.365,4.76z M14.005,4.386   c0.004,0.016-0.029,0.019-0.025,0.042c0.004,0.023-0.012,0.026-0.029,0.05c-0.017,0.022-0.022,0.04-0.054,0.04   c-0.032-0.001-0.045,0.012-0.045,0.012s0.043-0.014,0.053,0.006c0.011,0.02,0.024,0.012,0.002,0.02l-0.019,0.001l-0.02,0.008   c-0.018,0.017-0.059,0.009-0.066,0.003l0.006,0.007c0.009,0.004,0.026,0.009,0.056,0.007c0.062-0.002,0.031-0.023,0.076,0.003   c0.023,0.013,0.029,0.013,0.032,0.013c0.004-0.001,0.003-0.001,0.014,0.015c0.021,0.031,0.031,0.008,0.043,0.053   c0.01,0.045,0.025,0.042,0.03,0.077c0.003,0.019,0.015,0.026,0.032,0.027c0.061,0.004,0.07,0.049,0.089,0.055   c0.055,0.022-0.017,0.005,0.007,0.027c0.023,0.024,0.041,0.05,0.033,0.054c-0.008,0.003-0.031-0.017-0.057-0.022   c0.03,0.018,0.033,0.022,0.064,0.035c0.032,0.012,0.032,0.044,0.007,0.061C14.209,4.996,14.209,4.982,14.231,5   c0.021,0.018,0.026,0.023,0.04-0.005c0.013-0.03,0.044-0.026,0.071-0.019c0.027,0.009,0.095,0.043,0.069,0.086   c-0.027,0.044,0.009,0.019-0.015,0.037c-0.025,0.02-0.041,0.015-0.041,0.015s0.028,0.011,0.007,0.022   c-0.02,0.012-0.032-0.006-0.032-0.006s0.003,0.003-0.013,0.009c-0.016,0.005,0.033,0.009,0.013,0.024   c-0.023,0.015-0.037,0.014-0.048,0.009l-0.022,0.01c0,0,0.043,0.013,0.067,0.016l0.039-0.003c0.017-0.003,0.03-0.005,0.028,0.001   c-0.005,0.015,0.01,0.03-0.02,0.037c-0.041,0.011-0.028,0.03-0.057,0.02l-0.026,0.01c-0.012,0.008-0.027,0.017-0.059,0.008   c-0.031-0.009-0.06-0.003-0.08,0.003c-0.02,0.006-0.032,0.012-0.03,0.005l-0.013-0.004l-0.028-0.007   c-0.015-0.018-0.031-0.028-0.021-0.012c0.011,0.015,0.002,0.024-0.015,0.024c-0.017-0.001-0.066-0.006-0.046,0.002   C14.02,5.29,14,5.31,13.972,5.301l-0.026-0.002l-0.021-0.006c-0.015-0.016-0.038-0.018-0.059-0.012   c-0.021,0.005-0.048-0.003-0.049,0.012c-0.001,0.016-0.006,0.041-0.021,0.045l-0.038-0.009l-0.032-0.015l-0.021,0.005l-0.032,0.003   c-0.003-0.014-0.003,0.015-0.035,0.015c-0.031-0.001,0.001,0.019-0.018,0.027l-0.021-0.007l-0.026-0.008   c-0.024,0.007-0.042-0.01-0.012-0.014c0.032-0.006,0.046-0.011,0.065-0.031c0.021-0.021,0.029-0.025,0.057-0.038   c0.027-0.013-0.009-0.04,0.022-0.033c0.031,0.009,0.012-0.019,0.028-0.023c0.065-0.016,0.057-0.002,0.074,0   c0.016,0.003,0.063,0.008,0.064-0.006l0.034-0.027c0.011,0.005,0.004-0.019,0.033-0.032c-0.042,0.013-0.033,0.024-0.062,0.024   c-0.027,0-0.016,0.02-0.05,0.019c-0.035,0-0.055-0.033-0.055-0.033s-0.014,0.002-0.03,0.008c-0.017,0.004-0.032-0.011-0.017-0.011   l-0.001-0.014l-0.019-0.003l-0.013,0.002c-0.019,0-0.053,0.022-0.042,0.01l-0.016-0.003l-0.018-0.007   c0.013-0.017-0.019-0.033,0.005-0.034c0.025-0.003,0.045-0.019,0.069-0.02c0.022-0.002,0.059-0.016,0.069-0.047   c0.003-0.008-0.029-0.005,0.005-0.027L13.76,5.004c-0.011,0-0.026,0.001-0.001-0.019c-0.031,0-0.046-0.002-0.052,0.013L13.695,5   L13.68,4.998c-0.016,0.003-0.002-0.017,0.023-0.022c0.024-0.003,0.01-0.018,0.034-0.028c0.022-0.011-0.082-0.004-0.034-0.026   c0.05-0.023,0.055,0.012,0.043,0.019c-0.011,0.007,0.015-0.007,0.04-0.013l0.021,0.001h0.024c0.016-0.004,0.027,0.001,0.032,0.008   V4.921l0.019,0.008c0.01,0.008,0.02,0.015,0.031-0.001c-0.024,0.004-0.036-0.016-0.048-0.02c0.008-0.022,0.031-0.031,0.031-0.031   s-0.036,0.008-0.02-0.019c0.017-0.027,0.038-0.047,0.009-0.038l-0.023-0.009l-0.008-0.004c-0.007,0.021,0.008,0.046-0.02,0.003   c-0.028-0.043-0.022-0.054-0.006-0.07c0.016-0.017,0.041-0.023,0.041-0.023l-0.05-0.005l-0.007,0.007l-0.014,0.005l-0.019,0.007   L13.76,4.736c-0.017-0.021-0.025-0.012-0.032-0.002l-0.016,0.007c-0.015-0.019-0.026-0.025-0.038-0.019l0.004,0.026l-0.031-0.043   l0.022,0.007c0.009-0.005-0.011-0.015,0.005-0.034c0.017-0.019,0.017-0.029,0.034-0.037c0.017-0.007-0.032-0.021-0.024-0.043   c0.008-0.021,0.041-0.017,0.041-0.017s-0.047,0-0.028-0.033c-0.018,0.027-0.04,0.062-0.058,0.024l-0.002,0.02   c0.005,0.01-0.023,0.029-0.027,0.053c-0.003,0.023-0.027,0.019-0.015-0.01c0.013-0.03,0.027-0.043,0.016-0.055   c-0.01-0.011,0.006-0.003,0.011-0.025c0.006-0.023-0.006-0.047,0.019-0.047l-0.006-0.015l-0.007-0.007l-0.015-0.009   c0.012-0.013-0.011-0.01-0.031-0.008c-0.016,0.001-0.03,0.003-0.015-0.004c0.034-0.016,0.037-0.031,0.05-0.031   c0.013,0-0.015-0.013,0.023-0.013c0.038,0-0.041-0.018-0.016-0.029c0.025-0.011-0.018-0.026,0-0.033   c0.015-0.008-0.038-0.033-0.013-0.034c0.025-0.001,0.034-0.02,0.046-0.008l0.027,0.011c0,0-0.053-0.035-0.034-0.035   c0.018,0.001-0.011-0.024,0.009-0.024l0.016-0.008l0.013-0.008c0.02,0.002-0.029-0.015,0.011-0.032   c0.016-0.007,0.037,0.003,0.028,0.016l0.011-0.001l0.008,0.007c0,0,0.025-0.013,0.044-0.011c0.018,0.002,0.058,0.003,0.061-0.004   l0.031,0.007c-0.014,0.016,0.016,0.022-0.014,0.035c-0.029,0.013-0.058,0.036-0.071,0.042l-0.031,0.013l0.035,0.017   c-0.009,0.011-0.006,0.011-0.023,0.011c-0.017-0.001,0.007,0.006-0.004,0.013c-0.01,0.008,0.007,0.003,0.027-0.002   c0.02-0.004,0.047-0.019,0.084-0.007c0.021,0.007,0.028,0.004,0.036,0.002h0.028l0.025,0.001C13.988,4.36,13.998,4.36,14.005,4.386   z M13.51,4.845l0.012,0.02l0.013,0.028c-0.015,0.001,0.012,0.018-0.007,0.019c-0.021,0.002,0.011,0.017,0.009,0.026l-0.002,0.033   l-0.003,0.027c-0.013,0.013,0.009,0.014-0.009,0.027C13.505,5.038,13.51,5.043,13.5,5.05c-0.011,0.007,0.016,0.029-0.001,0.028   h-0.013L13.46,5.069l-0.023,0.004l-0.012,0.005l0.001-0.041l-0.01,0.04c-0.004-0.005-0.015-0.003-0.04-0.002   c-0.024,0-0.013,0.01-0.031,0.01L13.331,5.09l-0.018,0.007l-0.018,0.008l-0.02,0.008c-0.027-0.003-0.02,0.019-0.047,0.019   l-0.018,0.005l-0.02,0.003l-0.033,0.006l-0.023,0.006c-0.014-0.01-0.037-0.006-0.056,0l0-0.008l0.004-0.008l0.022-0.009   l0.015-0.009L13.096,5.12l-0.031,0.005c-0.021,0.01-0.041,0.001-0.015-0.008c0.025-0.009,0.064-0.023,0.064-0.023   s-0.032,0.002-0.055,0.011c-0.016,0.006-0.021,0.002-0.024-0.002l-0.008-0.005c-0.012,0.003-0.039-0.003-0.012-0.014   c0.027-0.011,0.041-0.01,0.055-0.017l0.03-0.009c0,0-0.036-0.003-0.053,0.001h-0.018h-0.02c-0.019,0.004,0.003-0.017,0.021-0.02   l0.02,0l0.015,0l0.034,0.005L13.086,5.03c0.007-0.006-0.024-0.009,0.006-0.014c0.028-0.005-0.001-0.015,0.034-0.015   c0.017,0.001,0.037-0.002,0.056-0.004c0.018-0.003,0.035-0.004,0.045-0.004l-0.018,0l-0.009-0.011l-0.009-0.001   c-0.014,0.014-0.034,0.023-0.05,0.017C13.123,4.993,13.119,5,13.098,5c-0.022,0-0.022,0.001,0.005-0.011   c0.025-0.011,0.012-0.018,0.022-0.012l0.023-0.025v-0.01c0.016-0.011,0.01-0.016,0.04-0.015c0.03,0.001,0.026-0.016,0.002-0.016   c-0.023,0-0.065,0.009-0.058-0.002l-0.013-0.013l-0.018-0.005l-0.007-0.01c-0.015,0.007-0.038-0.001-0.02-0.006   c0.017-0.005-0.016-0.013,0.005-0.017l0.022,0.002l0.009-0.003c-0.009-0.008-0.016-0.022,0.011-0.022   c0.029,0,0.027-0.013,0.007-0.014c-0.019-0.001-0.032,0-0.035-0.006l-0.02-0.012c0.011-0.002,0.023-0.006,0.043,0.005l-0.012-0.031   V4.763l0.013,0l0.016-0.003l0.055,0.013l0.023,0.003l0.013-0.003c0.033,0.005,0.019,0.01,0.036,0.015   c0.016,0.006-0.018-0.019-0.001-0.024c0.024-0.008,0.037-0.005,0.038-0.018c0.001-0.012,0.034-0.016,0.01-0.012   c-0.027,0.006-0.039,0.006-0.051-0.005c-0.011-0.011-0.025-0.011-0.001-0.014c0.023-0.001,0.003-0.009,0.025-0.013   c0.021-0.003-0.005-0.012,0.014-0.022c0.018-0.009,0.006-0.028,0.022-0.022l0.019-0.001l0.018,0l0.016-0.006l0.013-0.005   l0.007,0.035c0.027-0.021,0.004-0.034,0.014-0.036c0.018-0.002,0.011-0.014,0.034,0c0.021,0.013,0.033,0.012,0.013,0.018   c-0.022,0.007-0.04,0.014-0.028,0.014l0.037-0.005c0.01-0.009,0.025-0.007,0.044-0.013l0.03,0.003l0.017,0.004l0.011,0.02   L13.568,4.7l0.019,0.017l-0.006,0.015l-0.017,0.016l0.02-0.007l0.024,0.009l-0.002,0.033l-0.028,0.018l-0.017,0.007l-0.023,0.015   l-0.006,0.002L13.52,4.829C13.498,4.822,13.501,4.841,13.51,4.845z M13.945,3.15l-0.024,0.022l0.025,0l0.019,0.002   c-0.005,0.009,0.003,0.019-0.014,0.027L13.93,3.202l-0.016,0.024l-0.007,0.008l-0.02-0.004c-0.023,0.005-0.029,0.022-0.023,0.033   L13.857,3.27c-0.02,0.003-0.03,0.009-0.043,0.015l-0.016,0.003c-0.03-0.003-0.055,0.002-0.079,0.014   c-0.017,0.009-0.045,0.015-0.062,0.027l-0.018,0.006l-0.038,0.013c-0.034,0.003-0.07,0.003-0.097,0.014   c-0.017,0.007-0.019,0.018-0.037,0.023C13.439,3.391,13.41,3.398,13.379,3.4c-0.044,0.003-0.079-0.006-0.121-0.01l-0.023,0.001   c-0.047-0.01-0.062-0.05-0.131-0.034l-0.017-0.001l-0.032,0.001c-0.013,0.001-0.027,0.002-0.043-0.001l-0.042,0.005l-0.005-0.007   l0.012-0.015c0.038-0.005,0.102-0.011,0.101-0.034L13.1,3.302l0.009-0.006l-0.044-0.003l0.015-0.014L13.06,3.28l-0.026-0.003   l-0.01-0.016v-0.01c-0.032-0.009-0.069,0-0.106,0.005l-0.018-0.003h-0.011L12.88,3.249c0.035-0.015,0.079-0.015,0.123-0.022   c0.017-0.003,0.034-0.003,0.051-0.003c0.023,0,0.044,0,0.058-0.008l-0.016-0.002l-0.029,0.001l-0.005-0.005l-0.023-0.003   c0.007-0.015,0.046-0.023,0.075-0.03l0.004-0.004c-0.025-0.001-0.046-0.002-0.071-0.005L13.021,3.17l-0.005-0.004   c-0.03,0.003-0.05,0.013-0.078,0.019c-0.028,0.004-0.04-0.008-0.063-0.011L12.86,3.172l-0.005-0.008   c0.017-0.01,0.028-0.009,0.053-0.005l0.003-0.009v-0.01l0.013-0.001l0.03,0.011l0.028-0.009l-0.007-0.003   c-0.017-0.003-0.037-0.003-0.04-0.01h0.028l-0.017-0.014l0.023-0.004l0.018,0l-0.01-0.01l0.031-0.005   c0.024,0.013,0.051,0.022,0.074,0.035c0.021-0.011,0.004-0.021-0.002-0.031l-0.024-0.013l0.022-0.004l-0.01-0.006l-0.02,0.001   l-0.025-0.001l0.013-0.007c0.013-0.007,0.035-0.008,0.056-0.008c0.027,0,0.018,0.015,0.034,0.02l0.018,0.007l0.037,0.024   L13.178,3.12c0.02,0.009,0.017,0.018-0.003,0.028L13.17,3.157l-0.032-0.006l0.038,0.021l0.006,0.031L13.194,3.2V3.19l0.012-0.015   c0.024-0.007,0.013-0.029,0.041-0.024l0.011,0.009l0.017-0.003l0.009-0.019l-0.017-0.013l0.021-0.022   c0.018-0.007,0.049-0.004,0.045,0.01l0.006,0.003c-0.003,0.01,0.006,0.018,0.023,0.022l0.019-0.005l-0.004-0.027   c0.014-0.007,0.038-0.011,0.059-0.017l0.025,0.005l0.013,0.019c0.022,0.008,0.024,0.027,0.044,0.022   c0.022-0.005-0.009-0.022-0.022-0.032c0.033-0.009,0.053,0.006,0.078,0.008c0.027,0.004,0.02-0.022,0.043-0.025l0.018,0.002   l0.033-0.003l-0.001-0.007V3.056l0.01-0.006l0.037-0.006h0.01c0.001,0.01,0.009,0.019,0.036,0.021l0.004,0.008l0.001,0.008   l0.033-0.007c0.019-0.009,0.046-0.018,0.072-0.013l-0.01,0.004l0.003,0.003c-0.024,0.004-0.053,0.017-0.029,0.024l0.026,0.001   c0.012,0.01-0.006,0.023-0.025,0.033l0.018,0l0.025,0l0.013,0.011h0.019L13.945,3.15z M7.963,1.931   c0.073-0.001,0.102-0.042,0.156-0.035c0.054,0.007,0.118,0.006,0.153-0.014c0.019-0.012,0-0.009-0.031-0.005   C8.218,1.88,8.188,1.882,8.162,1.878C8.104,1.867,8.079,1.86,8.049,1.877C8.032,1.886,8.029,1.883,8.022,1.88   C8.016,1.877,8.007,1.874,7.986,1.879c-0.047,0.01-0.069,0.029-0.11,0.012C7.857,1.882,7.813,1.891,7.773,1.9   C7.724,1.91,7.684,1.92,7.705,1.902c0.039-0.035,0.193-0.042,0.211-0.059c0.017-0.016,0.101-0.007,0.135-0.021   c0.017-0.006,0.035-0.001,0.056,0.005c0.021,0.005,0.044,0.011,0.07,0.004c0.05-0.014,0.112-0.006,0.16-0.018   c0.022-0.005,0.043-0.002,0.068,0c0.032,0.003,0.072,0.006,0.125-0.005c0.098-0.023,0.153-0.01,0.229-0.019   C8.793,1.786,8.817,1.79,8.839,1.795C8.867,1.8,8.893,1.806,8.931,1.796c0.068-0.017,0.1-0.023,0.188-0.005   c0.134,0.029,0.2-0.032,0.364-0.043c0.086-0.007,0.105,0.003,0.139,0.014C9.652,1.77,9.69,1.779,9.794,1.777   c0.224-0.005,0.04,0.058-0.04,0.073c-0.08,0.018-0.169,0.02-0.281,0.074c-0.11,0.053-0.178,0.039-0.345,0.09   C9.044,2.04,9.001,2.033,8.964,2.025C8.928,2.019,8.9,2.012,8.846,2.036C8.786,2.065,8.74,2.055,8.707,2.04   C8.673,2.025,8.632,2.015,8.591,2.06C8.552,2.103,8.402,2.072,8.369,2.062c-0.016-0.006-0.032,0-0.053,0.006   C8.294,2.074,8.268,2.08,8.233,2.073C8.167,2.06,8.171,2.04,8.199,2.085c0.027,0.046-0.026,0.032-0.111,0.027   C8.003,2.108,8.038,2.122,8.086,2.16c0.049,0.038-0.072,0.025-0.119,0.024c-0.047,0-0.07,0.046-0.133,0.054   c-0.029,0.004-0.05-0.003-0.069-0.009C7.742,2.222,7.723,2.214,7.699,2.224C7.657,2.239,7.594,2.206,7.548,2.2   C7.503,2.194,7.493,2.229,7.424,2.245C7.356,2.261,7.319,2.247,7.232,2.228c-0.049-0.011-0.066-0.005-0.09,0.002   c-0.02,0.005-0.045,0.01-0.096,0.005C6.987,2.229,6.971,2.214,7.027,2.193c0.056-0.022,0.124-0.025,0.163-0.03   C7.227,2.158,7.185,2.14,7.245,2.123c0.06-0.018,0.107-0.022,0.178-0.004c0.069,0.016,0.091,0.03,0.149,0.019   c0.057-0.013-0.167-0.03-0.099-0.037c0.067-0.006,0.186-0.021,0.136-0.023c-0.02-0.001-0.046,0.004-0.073,0.009   C7.494,2.094,7.452,2.102,7.432,2.089C7.4,2.067,7.429,2.046,7.528,2.038c0.284-0.021,0.015-0.042,0.188-0.049   c0.043-0.001,0.15-0.036,0.14-0.004C7.849,2.002,7.86,2.002,7.878,2.002L7.921,2.01C7.954,2.028,7.888,1.931,7.963,1.931z    M8.621,5.549c-0.006,0.026-0.043,0.048-0.04,0.017C8.584,5.535,8.57,5.513,8.593,5.486c0.009-0.01-0.007-0.018,0.015-0.036   C8.624,5.437,8.63,5.438,8.637,5.438l0.021-0.005C8.682,5.42,8.707,5.4,8.728,5.392c0.021-0.009,0.046,0,0.02,0.014   C8.718,5.422,8.692,5.455,8.711,5.445C8.73,5.435,8.761,5.403,8.757,5.43C8.754,5.456,8.761,5.481,8.744,5.495   C8.726,5.509,8.717,5.538,8.725,5.55L8.684,5.586L8.671,5.588C8.661,5.593,8.65,5.597,8.644,5.58   c-0.01-0.028-0.003-0.042,0.004-0.065C8.655,5.493,8.628,5.525,8.621,5.549z M8.745,5.322c-0.015,0.016-0.044,0.02-0.063,0.02   C8.663,5.339,8.756,5.35,8.721,5.367C8.688,5.384,8.661,5.411,8.66,5.394C8.658,5.38,8.647,5.377,8.634,5.405   C8.621,5.432,8.605,5.432,8.581,5.448L8.561,5.452L8.535,5.463C8.508,5.489,8.525,5.501,8.506,5.505   C8.487,5.509,8.491,5.526,8.47,5.531C8.448,5.538,8.42,5.553,8.401,5.553c-0.019,0-0.012-0.009-0.033-0.008   c-0.021,0.003-0.021-0.022,0-0.027C8.39,5.513,8.43,5.496,8.433,5.484c0.003-0.014,0.031-0.032,0.051-0.04   c0.022-0.008-0.012-0.007-0.04,0.003C8.417,5.456,8.417,5.44,8.407,5.44c-0.012,0-0.003,0.011-0.029,0.011L8.371,5.438   C8.374,5.43,8.379,5.421,8.363,5.427c-0.031,0.01-0.05,0.025-0.051,0.013L8.288,5.438L8.267,5.437   c0.001-0.008-0.011,0.001-0.026,0.01L8.196,5.458L8.169,5.464C8.157,5.469,8.138,5.474,8.108,5.469   C8.08,5.465,8.072,5.462,8.07,5.458C8.065,5.462,8.056,5.467,8.031,5.463C7.988,5.458,7.952,5.47,7.939,5.476   C7.926,5.482,7.921,5.474,7.928,5.454C7.935,5.433,7.9,5.421,7.931,5.408c0.03-0.014,0.055-0.035,0.081-0.037   c0.028-0.005,0.056-0.028,0.03-0.022c-0.025,0.007-0.085,0.032-0.06,0.01L8,5.348C8.003,5.349,8.009,5.35,8.031,5.339   c0.048-0.021,0.019-0.021,0.053-0.047c0.035-0.028,0.041-0.013,0.085-0.023C8.153,5.261,8.173,5.251,8.158,5.248   C8.143,5.244,8.148,5.234,8.18,5.215c0.032-0.019,0.014-0.029,0.048-0.041c0.033-0.011,0.027-0.04,0.049-0.062l0.101-0.117   c0.03-0.011,0.058-0.024,0.049-0.036C8.418,4.946,8.431,4.956,8.46,4.939c0.031-0.017,0.019-0.035,0.051-0.047   C8.543,4.88,8.554,4.887,8.574,4.883l0.004,0.005l0.006,0.003C8.612,4.879,8.616,4.883,8.615,4.9c0,0.017-0.019,0.02-0.034,0.023   C8.567,4.925,8.555,4.948,8.572,4.941C8.59,4.935,8.608,4.942,8.593,4.957L8.564,4.994l-0.02,0.012L8.519,5.019L8.501,5.035   L8.482,5.051c-0.017-0.006,0,0.009-0.022,0.022C8.437,5.087,8.384,5.12,8.395,5.139c0.032-0.026,0.068-0.057,0.088-0.061   l0.009,0.006L8.499,5.09l0.016,0.004l0.019,0.002c0.018-0.008,0.037-0.014,0.018,0.006C8.531,5.12,8.475,5.117,8.457,5.134   c0.047-0.01,0.061,0.002,0.048,0.01C8.493,5.153,8.547,5.149,8.533,5.171l0.016,0.01l0.019,0.011   C8.555,5.213,8.591,5.207,8.615,5.2h0.019c0.005,0.002,0.01,0.004,0.026,0c0.031-0.006,0.072-0.015,0.084,0.012   c0.011,0.026-0.011,0.015-0.015,0.03L8.716,5.25l-0.01,0.005C8.703,5.269,8.687,5.274,8.663,5.281l0.01,0.001l0.034,0.001   c0.016,0.002,0.027,0.005,0.046-0.003c0.019-0.008,0.024,0,0.014,0.021C8.76,5.321,8.761,5.305,8.745,5.322z M8.747,3.06   c0.015,0.024-0.006,0.022-0.031,0.02C8.692,3.078,8.663,3.076,8.669,3.103C8.674,3.129,8.65,3.12,8.626,3.111   C8.6,3.102,8.575,3.093,8.593,3.129c0.02,0.038-0.005,0.031-0.023,0.023L8.559,3.156c0.017,0.018,0,0.016-0.017,0.014L8.525,3.176   c0.02,0.022,0.041,0.044-0.009,0.06C8.491,3.245,8.484,3.229,8.479,3.212C8.474,3.196,8.471,3.179,8.453,3.19   C8.42,3.208,8.466,3.165,8.413,3.16C8.36,3.153,8.437,3.06,8.408,3.091c-0.03,0.03-0.061,0.062-0.064,0.04H8.327   c-0.01,0.006-0.021,0.013-0.024-0.01C8.295,3.079,8.261,3.087,8.226,3.099C8.192,3.111,8.21,3.111,8.162,3.082   C8.139,3.068,8.155,3.089,8.167,3.11c0.013,0.023,0.018,0.046-0.044,0.022C8.065,3.111,8.142,3.173,8.108,3.185   c-0.034,0.013-0.022,0.033,0.04,0.026c0.062-0.005,0.019,0.034,0.094,0.05C8.316,3.279,8.2,3.291,8.257,3.309   c0.058,0.016-0.021,0.034,0.006,0.053C8.292,3.38,8.281,3.372,8.262,3.4c-0.009,0.012-0.025,0.006-0.043,0   C8.201,3.394,8.185,3.387,8.177,3.402C8.169,3.414,8.151,3.401,8.132,3.387C8.113,3.374,8.093,3.36,8.085,3.374   C8.067,3.401,8.014,3.371,7.908,3.365c0.109,0.022,0.065,0.064,0.095,0.064c0.08-0.003,0.015,0.044,0.081,0.048   c0.066,0.001,0.062,0.012,0.028,0.028C8.079,3.522,8.162,3.532,8.119,3.556C8.098,3.567,8.076,3.559,8.055,3.55   C8.032,3.542,8.011,3.533,7.993,3.547C7.96,3.575,7.824,3.521,7.812,3.503l-0.036,0L7.744,3.509   C7.716,3.505,7.731,3.444,7.703,3.521c-0.012,0.032-0.071-0.01-0.137-0.012C7.498,3.509,7.547,3.437,7.522,3.464   C7.494,3.493,7.462,3.478,7.437,3.449C7.41,3.42,7.336,3.414,7.273,3.405C7.211,3.395,7.327,3.33,7.284,3.351   C7.242,3.371,7.209,3.342,7.185,3.317c-0.024-0.026,0.016,0.027,0.04,0.061c0.019,0.028-0.029,0.013-0.073-0.002   C7.111,3.362,7.073,3.348,7.096,3.369c0.016,0.015-0.013,0.012-0.037,0.01C7.041,3.377,7.027,3.375,7.037,3.38   c0.025,0.011-0.054,0.002-0.03,0.026C7.024,3.422,6.996,3.42,6.968,3.418l-0.03-0.001c-0.024,0-0.078,0.001-0.057-0.029   c0.023-0.03-0.021,0.002-0.001-0.054C6.91,3.254,7.003,3.3,6.919,3.257C6.877,3.237,6.92,3.241,6.967,3.245   c0.052,0.005,0.11,0.009,0.06-0.02c-0.052-0.032,0.029-0.023,0.1-0.014c0.053,0.007,0.1,0.014,0.077,0.002   C7.176,3.2,7.218,3.202,7.26,3.204C7.3,3.206,7.337,3.208,7.321,3.198c-0.017-0.011,0.009-0.01,0.038-0.009   C7.391,3.19,7.426,3.19,7.414,3.177C7.39,3.15,7.475,3.165,7.542,3.188c-0.008-0.034-0.114-0.05-0.096-0.072   c0.017-0.024,0.081-0.026,0.106-0.043c0.025-0.019,0.091,0.017,0.131,0.024c0.042,0.005,0.05,0.013,0.02,0.041   c-0.03,0.028-0.014,0.027-0.028,0.054c-0.013,0.027,0.02,0.021,0.081-0.033c0.037-0.034,0.049-0.033,0.069-0.032   C7.836,3.128,7.851,3.129,7.878,3.12c0.068-0.021,0.109-0.033,0.039-0.031c-0.07,0.002-0.066-0.014-0.064-0.056   c0.002-0.041-0.051,0.013-0.098,0.042C7.708,3.102,7.671,3.07,7.611,3.059C7.548,3.046,7.645,3.032,7.699,3   c0.056-0.031,0.059-0.017,0.121-0.034c0.064-0.017,0.004-0.05,0-0.087C7.82,2.841,7.776,2.866,7.754,2.841   C7.739,2.823,7.72,2.825,7.697,2.826h-0.03C7.648,2.825,7.648,2.835,7.645,2.845c-0.003,0.009-0.01,0.019-0.042,0.018   C7.537,2.861,7.58,2.818,7.63,2.809C7.68,2.8,7.626,2.774,7.581,2.78C7.56,2.782,7.558,2.772,7.557,2.762   c-0.001-0.011,0-0.023-0.025-0.015C7.508,2.754,7.503,2.742,7.493,2.731c-0.008-0.01-0.02-0.02-0.05-0.018   C7.418,2.713,7.406,2.707,7.4,2.701C7.39,2.689,7.396,2.679,7.39,2.702C7.379,2.741,7.288,2.669,7.288,2.669   S7.329,2.74,7.281,2.759C7.254,2.77,7.236,2.76,7.217,2.749C7.202,2.74,7.185,2.731,7.164,2.735C7.119,2.746,7.258,2.772,7.2,2.793   C7.14,2.813,7.154,2.775,7.106,2.745c-0.049-0.03,0.002,0.028-0.032,0.054C7.056,2.813,7.045,2.8,7.033,2.786   C7.023,2.774,7.011,2.762,6.992,2.77c-0.022,0.01-0.022,0.005-0.029,0C6.96,2.767,6.954,2.765,6.935,2.765   C6.89,2.769,6.902,2.758,6.936,2.727C6.907,2.735,6.907,2.735,6.873,2.758c-0.035,0.025-0.054,0.002-0.107,0   C6.711,2.758,6.738,2.726,6.674,2.752c-0.063,0.025-0.02,0-0.13,0.031c-0.11,0.031-0.245-0.084-0.117-0.097   c0.066-0.006-0.077-0.033,0.034-0.073c0.094-0.035,0.073-0.044,0.13-0.085c0.025-0.017,0.068-0.032,0.1-0.041   C6.766,2.464,6.81,2.459,6.915,2.455C7.018,2.45,6.987,2.484,6.934,2.514C6.893,2.538,6.896,2.574,6.84,2.595   C6.791,2.614,6.781,2.668,6.823,2.697C6.805,2.585,7.056,2.635,6.971,2.604c-0.136-0.05,0.118-0.077,0.08-0.083   C6.954,2.508,7.093,2.508,7.149,2.484c0.055-0.025,0.044-0.01,0.129-0.035C7.364,2.422,7.465,2.43,7.502,2.42   C7.537,2.41,7.516,2.445,7.54,2.466C7.564,2.488,7.492,2.513,7.545,2.51c0.055-0.004,0.017,0.02-0.018,0.063   C7.492,2.616,7.574,2.591,7.617,2.539c0.022-0.024,0.027-0.015,0.034-0.007c0.009,0.01,0.018,0.02,0.05-0.018   c0.034-0.038,0.047-0.013,0.053,0.012C7.76,2.547,7.762,2.568,7.77,2.554c0.008-0.018,0.054,0.019,0.083,0.044   C7.785,2.529,7.925,2.578,7.85,2.536C7.773,2.493,7.868,2.48,7.968,2.474c0.049-0.002,0.07,0.017,0.084,0.035   c0.013,0.02,0.02,0.039,0.041,0.035c0.02-0.003,0.038,0.002,0.057,0.007c0.019,0.006,0.039,0.012,0.058,0.006   c0.052-0.011,0.076,0,0.092,0.012c0.017,0.012,0.023,0.025,0.042,0.009C8.36,2.563,8.358,2.587,8.357,2.611   c-0.001,0.024,0,0.048,0.026,0.032c0.052-0.032,0.068-0.021,0.104-0.011c0.037,0.011-0.042,0.032-0.084,0.064   C8.36,2.726,8.347,2.731,8.418,2.699c0.073-0.034,0.085-0.056,0.137-0.026c0.054,0.028,0.006,0.035,0.049,0.067   c0.041,0.03-0.205,0.05-0.169,0.07C8.451,2.817,8.484,2.81,8.519,2.803c0.042-0.008,0.085-0.017,0.102,0.001   c0.033,0.034-0.054,0.02-0.088,0.048c0.03-0.011,0.039-0.004,0.049,0.003c0.011,0.008,0.021,0.015,0.059-0.002   c0.038-0.017,0.039-0.003,0.036,0.01C8.676,2.875,8.672,2.887,8.69,2.878c0.018-0.01,0.018,0,0.02,0.01   C8.711,2.899,8.715,2.909,8.742,2.9c0.026-0.011,0.03-0.001,0.032,0.009c0.002,0.01,0.004,0.019,0.022,0.011   C8.834,2.901,8.843,2.92,8.838,2.943c-0.006,0.023,0.007,0.018,0.07-0.017c0.064-0.035,0.009,0.023,0.083,0.04   c0.075,0.019-0.075-0.003-0.043,0.044c0.015,0.023-0.016,0.016-0.049,0.009C8.864,3.011,8.827,3.004,8.84,3.031   c0.013,0.028-0.019,0.022-0.049,0.017C8.761,3.042,8.733,3.036,8.747,3.06z M6.156,2.563c0.026,0.013-0.03,0.027-0.048,0.039   C6.092,2.614,6.064,2.595,6.041,2.579c-0.026-0.02,0.043-0.032,0.041-0.062C6.079,2.459,6.141,2.47,6.186,2.45   c0.031-0.015,0.095-0.013,0.151-0.009c0.024,0.001,0.046,0.002,0.064,0.002c0.06-0.001,0.147,0.008,0.097,0.021   C6.45,2.481,6.374,2.51,6.344,2.545c-0.028,0.031-0.095,0.01-0.179-0.004C6.079,2.527,6.13,2.552,6.156,2.563z M6.393,2.364   c-0.012,0-0.029,0.001-0.045,0.002C6.316,2.369,6.287,2.372,6.305,2.36c0.027-0.016,0.066-0.041,0.143-0.033   c0.069,0.008,0.045,0.056,0.024,0.065C6.415,2.417,6.391,2.413,6.314,2.418C6.238,2.423,6.176,2.397,6.256,2.389   C6.337,2.382,6.431,2.367,6.393,2.364z M7.613,2.406C7.676,2.404,7.703,2.373,7.754,2.4c0.052,0.027,0.143,0.03,0.097,0.049   C7.806,2.467,7.773,2.453,7.732,2.47c-0.039,0.016-0.08,0.042-0.123,0.031c-0.041-0.009-0.017-0.028-0.036-0.05   C7.553,2.429,7.551,2.409,7.613,2.406z M6.902,2.113C6.957,2.099,6.88,2.101,6.979,2.082C7.077,2.064,6.945,2.03,7.029,2   c0.086-0.031,0.148-0.017,0.192-0.047c0.042-0.031,0.082-0.034,0.145-0.048C7.43,1.891,7.532,1.857,7.459,1.914   C7.424,1.94,7.466,1.931,7.516,1.92c0.057-0.011,0.123-0.022,0.105,0.017C7.593,2.001,7.526,1.985,7.573,1.991   c0.045,0.007-0.027,0-0.09,0.022c-0.064,0.021-0.13,0.07-0.2,0.07c-0.02,0.001-0.045-0.001-0.068-0.003   C7.161,2.077,7.111,2.074,7.121,2.092C7.136,2.119,7.098,2.135,7.056,2.13C7.012,2.123,7.001,2.132,6.993,2.14   C6.984,2.148,6.978,2.156,6.94,2.149C6.876,2.139,6.846,2.126,6.902,2.113z M6.709,2.229c0.01,0.009,0.022,0.017,0.065,0.011   C6.861,2.229,6.78,2.289,6.721,2.299c-0.057,0.01,0.065,0.001,0.07,0.02c0.001,0.01,0.021,0.007,0.041,0.004   C6.853,2.32,6.874,2.318,6.88,2.326c0.006,0.01,0.035,0.002,0.066-0.006c0.027-0.007,0.055-0.014,0.072-0.01   C7.033,2.315,7.06,2.308,7.091,2.302c0.04-0.008,0.087-0.017,0.13-0.003c0.041,0.013,0.07,0.008,0.098,0.002   C7.34,2.297,7.361,2.293,7.385,2.297C7.415,2.302,7.45,2.295,7.483,2.288C7.515,2.281,7.543,2.274,7.56,2.279   c0.032,0.01,0.005-0.015,0.091-0.019c0.088-0.003,0.064,0.048,0.133,0.076C7.853,2.364,7.75,2.356,7.675,2.37   C7.601,2.385,7.629,2.392,7.556,2.351c-0.072-0.039,0.015,0.03-0.034,0.04C7.499,2.395,7.486,2.39,7.47,2.385   C7.452,2.38,7.434,2.374,7.397,2.384C7.331,2.402,7.282,2.392,7.224,2.389C7.167,2.388,7.19,2.421,7.066,2.421   c-0.037,0.001-0.03-0.009-0.018-0.02C7.06,2.39,7.076,2.379,7.056,2.381C7.013,2.382,6.97,2.429,6.903,2.432   C6.837,2.433,6.83,2.423,6.814,2.404C6.799,2.386,6.772,2.424,6.68,2.437C6.548,2.454,6.559,2.385,6.61,2.367   c0.048-0.015,0.048-0.035,0.007-0.054C6.579,2.335,6.472,2.335,6.495,2.312C6.52,2.289,6.422,2.266,6.47,2.245   c0.049-0.02,0.107-0.012,0.18-0.026C6.689,2.212,6.698,2.22,6.709,2.229z M6.63,2.069C6.624,2.096,6.666,2.113,6.635,2.13   C6.621,2.137,6.607,2.135,6.589,2.133C6.57,2.131,6.546,2.128,6.508,2.14c-0.069,0.021-0.137,0.045-0.08,0.004   C6.509,2.085,6.635,2.041,6.63,2.069z M6.448,2.027C6.572,1.994,6.51,2.032,6.52,2.058c0.009,0.026-0.076,0.031-0.113,0.047   C6.37,2.12,6.326,2.175,6.25,2.158c-0.044-0.01-0.014-0.027,0.029-0.048C6.3,2.101,6.294,2.104,6.281,2.107L6.229,2.101   C6.206,2.076,6.324,2.059,6.448,2.027z M5.701,2.232c0.033-0.002,0.058,0,0.078,0.002c0.017,0.002,0.03,0.003,0.041,0.003   l0.03,0.028c0.009,0.021,0.012,0.041,0.013,0.018C5.865,2.245,5.83,2.201,5.911,2.19c0.08-0.012,0.181-0.059,0.144-0.011   C6.017,2.228,5.98,2.302,6.02,2.266c0.04-0.036,0.056-0.065,0.135-0.071c0.079-0.008,0.263-0.031,0.196,0.018   C6.286,2.261,6.221,2.223,6.196,2.277C6.171,2.332,6.158,2.349,6.123,2.363C6.079,2.382,6.06,2.371,6.045,2.359   c-0.013-0.01-0.023-0.021-0.043-0.008c-0.061,0.038-0.109,0.052-0.11,0.002C5.892,2.328,5.863,2.336,5.827,2.346   C5.792,2.355,5.751,2.364,5.722,2.34c-0.062-0.046,0.044-0.041,0-0.065C5.707,2.269,5.686,2.264,5.666,2.26L5.701,2.232z    M5.569,2.543c0.064,0.005,0.066,0.013,0.068-0.001c0-0.012-0.047-0.034-0.077-0.043c-0.03-0.008,0.034-0.033,0.063-0.027   C5.638,2.474,5.654,2.473,5.67,2.471C5.687,2.469,5.704,2.467,5.718,2.47c0.015,0.005,0.036,0.001,0.057-0.003   c0.018-0.004,0.035-0.008,0.048-0.005c0.011,0.001,0.037-0.003,0.064-0.008C5.924,2.447,5.962,2.44,5.973,2.45   c0.02,0.018-0.053,0.019-0.063,0.031c-0.004,0.005,0.01,0.003,0.027,0.001c0.03-0.003,0.07-0.007,0.029,0.026   C5.926,2.539,5.867,2.537,5.851,2.549c-0.016,0.011,0.081,0.01,0.003,0.049C5.823,2.614,5.83,2.609,5.794,2.637   c-0.037,0.028-0.081,0.024-0.07,0C5.685,2.659,5.69,2.689,5.603,2.653L5.58,2.657C5.564,2.662,5.543,2.667,5.518,2.65   C5.497,2.635,5.45,2.616,5.422,2.624C5.395,2.63,5.339,2.568,5.357,2.558C5.402,2.53,5.505,2.54,5.569,2.543z M5.043,2.785   l0.015,0.004c0.081,0.015-0.019,0.057-0.079,0.063L4.967,2.851C4.992,2.829,5.018,2.808,5.043,2.785z M4.89,2.923   c0.037,0.011,0.065,0.003,0.054,0.014C4.925,2.954,4.896,2.976,4.827,2.981C4.85,2.962,4.87,2.942,4.89,2.923z M10.252,15.475   c-0.083,0.092-0.086,0.167-0.206,0.271c-0.141,0.128-0.121,0.36-0.241,0.454c-0.019,0.014-0.045,0.001-0.067-0.012   c-0.035-0.02-0.06-0.04-0.012,0.056c0.038,0.077-0.035,0.167,0.038,0.327c0.057,0.129-0.031,0.161-0.009,0.34   c0.024,0.178-0.098,0.101-0.032,0.253c0.066,0.153-0.11,0.081-0.066,0.249c0.053,0.201-0.161,0.154-0.135,0.339   c0.022,0.141-0.049,0.085-0.1,0.145c-0.081,0.095-0.11,0.082-0.13,0.069L9.26,17.964c-0.035,0.023-0.074,0.015-0.111,0.006   c-0.042-0.009-0.08-0.019-0.105,0.017c-0.047,0.067-0.113,0.066-0.291,0.241C8.581,18.4,8.695,18.509,8.69,18.541   c-0.021,0.133,0.09,0.216,0.016,0.28c-0.074,0.063,0.069,0.061-0.106,0.176c-0.176,0.113-0.045,0.155-0.11,0.252   c-0.065,0.094,0.034,0.21-0.112,0.299c-0.146,0.087,0.062,0.093-0.181,0.256c-0.079,0.125-0.263,0.146-0.328,0.087   c-0.032-0.03-0.059-0.025-0.083-0.019c-0.022,0.005-0.042,0.01-0.063-0.012c-0.043-0.048-0.207,0.023-0.236-0.21   c-0.05,0.163,0.097,0.157,0.019,0.186c-0.076,0.026,0.298,0.079,0.293,0.22c-0.006,0.125,0.049,0.125,0.084,0.125l0.029,0.008   c0.042,0.127,0,0.099-0.02,0.168c-0.055,0.183-0.129,0.135-0.229,0.183c-0.146,0.073-0.244,0.059-0.294,0.046   c-0.021-0.006-0.033-0.011-0.037-0.011c-0.027,0.002-0.034-0.006-0.038-0.014c-0.004-0.009-0.006-0.017-0.026-0.014   c-0.013,0.003-0.043,0.062,0,0.07c0.045,0.008,0.002,0.05,0.048,0.062c0.049,0.011,0.015,0.059-0.013,0.06   c-0.035,0.001-0.023,0.096,0.015,0.114c0.039,0.017-0.117,0.122-0.201,0.079c-0.084-0.04-0.127-0.01-0.102-0.04   c0.024-0.031-0.119,0-0.039,0.045c0.16,0.089-0.019,0.186,0.132,0.183c0.006,0,0.014,0.033,0.055,0.011   c0.061-0.029-0.056-0.031,0.017-0.039c0.096-0.011,0.038,0.025,0.055,0.066c0.016,0.037-0.035,0.052-0.046,0.021   c-0.009-0.034-0.118-0.008-0.114,0.006c0.003,0.012,0.098,0.017,0.105,0.033c0.005,0.015-0.067,0-0.05,0.061   c0.018,0.063-0.033,0.025,0.009,0.1c0.042,0.074-0.056,0.044-0.016,0.113c0.035,0.056-0.077,0.027-0.099,0.059   c-0.022,0.035-0.064,0.01-0.079,0.096c-0.02,0.105,0.05,0.085,0.088,0.135c0.048,0.061,0.075,0.056,0.1,0.051   c0.024-0.005,0.044-0.01,0.077,0.045c0.032,0.05-0.012,0.148-0.018,0.158c-0.202-0.104-0.406-0.19-0.605-0.306   c-0.209-0.123-0.357-0.193-0.556-0.329c-0.001-0.002-0.087-0.055,0.029-0.231c0.046-0.07,0.008-0.051-0.029-0.086   c-0.037-0.037-0.02-0.055-0.054-0.091c-0.019-0.02-0.033-0.013-0.046-0.006l-0.031,0.002c-0.021-0.016-0.026-0.009-0.027-0.001   l-0.008,0.004c-0.06-0.081,0.017-0.1-0.067-0.195C5.713,20.705,5.905,20.762,5.78,20.6c-0.062-0.082-0.038-0.136-0.065-0.151   c-0.027-0.019,0.047-0.013-0.04-0.075c-0.062-0.045-0.08-0.072-0.066-0.125c0.015-0.053,0.023-0.024,0.019,0.001   c-0.004,0.023,0.082,0.054,0.042-0.021c-0.039-0.077,0.024-0.059,0.004-0.094c-0.042-0.077,0.031-0.027-0.015-0.113   c-0.043-0.081,0.062-0.013,0.032-0.124c-0.033-0.129,0.027-0.109-0.014-0.202c-0.04-0.095,0-0.09-0.078-0.233   c-0.075-0.141-0.122-0.321-0.131-0.366c-0.005-0.027,0.005-0.016,0.017-0.007l0.026,0.007c0.014-0.018-0.022-0.021-0.005-0.046   l0.025,0.002c0.008,0.007,0.015,0.013,0.016-0.002c0.002-0.043-0.041,0.007-0.044-0.068c-0.004-0.074-0.076,0.035-0.051-0.208   c0.014-0.141,0.001-0.222,0.003-0.312c0.003-0.167,0.034-0.156,0.004-0.191c-0.057-0.064,0.01-0.038-0.035-0.122   c-0.046-0.084,0.002-0.072-0.065-0.168c-0.043-0.061,0.031,0.019,0.025-0.144c-0.003-0.074-0.018-0.072-0.027-0.07   c-0.008,0.002-0.011,0.003,0.004-0.043c0.032-0.099,0.004-0.057-0.039-0.158c-0.023-0.054-0.013-0.051-0.003-0.047   c0.009,0.003,0.018,0.007,0.003-0.027c-0.03-0.076-0.014-0.154-0.046-0.191c-0.066-0.079,0.002-0.034-0.043-0.108   C5.188,17.12,5.2,17.109,5.179,17.091c-0.072-0.061-0.114-0.082-0.134-0.124c-0.045-0.1-0.318-0.204-0.352-0.231   c-0.105-0.082-0.186-0.05-0.246-0.131c-0.061-0.082-0.124-0.082-0.178-0.152c-0.054-0.072-0.121-0.094-0.154-0.151   c-0.02-0.034-0.002-0.024,0.016-0.014l0.023,0.007c-0.001-0.045-0.121-0.159-0.092-0.214c0.029-0.055-0.032-0.022-0.044-0.117   c-0.011-0.096-0.078-0.074-0.109-0.204c-0.031-0.131-0.124-0.247-0.17-0.393c-0.048-0.146-0.075-0.078-0.095-0.133   c-0.019-0.056-0.081-0.071-0.11-0.137c-0.029-0.067-0.032-0.023-0.166-0.162c-0.081-0.084-0.04-0.136-0.049-0.147   c-0.046-0.053,0.032-0.038-0.052-0.122c-0.063-0.063-0.046-0.063-0.028-0.063c0.011,0,0.021,0,0.014-0.015   c-0.028-0.056,0.034-0.061,0.001-0.081c-0.035-0.022,0.071-0.107,0.088-0.101c0.046,0.014,0.037-0.029,0.106-0.128   c0.041-0.061-0.014-0.054-0.01-0.078c0.002-0.027-0.044-0.007-0.044,0.009c0.002,0.056-0.019,0.07-0.035,0.024   c-0.017-0.045-0.055-0.013-0.019-0.04c0.036-0.029-0.026-0.02-0.018-0.035c0.023-0.037-0.046-0.039-0.009-0.063   c0.037-0.026-0.027-0.045,0.032-0.048c-0.05-0.011,0.012-0.036-0.027-0.04c-0.039-0.002-0.007-0.07,0.053-0.175   c0.059-0.106-0.008-0.045,0.03-0.12c0.022-0.043,0.01-0.042-0.002-0.042c-0.01,0-0.019,0-0.013-0.02   c0.014-0.044,0.048-0.009,0.078-0.044c0.029-0.033,0.069-0.017,0.093-0.061c0.01-0.019-0.001-0.017-0.011-0.014   c-0.013,0.003-0.026,0.007,0.011-0.04c0.038-0.051,0.062-0.049,0.08-0.047l0.027-0.012c0.014-0.036-0.059-0.052-0.029-0.101   c0.045-0.07,0.156-0.031,0.149-0.084c-0.003-0.024,0.073-0.129,0.127-0.154c-0.043-0.025,0.027-0.044-0.003-0.044   c-0.032,0-0.01,0.025-0.058,0.006c-0.051-0.017-0.028-0.055-0.014-0.087c0.015-0.032-0.004-0.119-0.013-0.193   c-0.006-0.044-0.02-0.044-0.027-0.044L3.8,12.717c0.011-0.012,0.072-0.025,0.045-0.081c-0.032-0.061-0.031-0.06-0.026-0.059   c0.004,0.001,0.008,0.002,0.007-0.014c-0.007-0.081-0.03-0.048-0.034-0.065c-0.008-0.029-0.018-0.029-0.026-0.029l-0.01-0.012   c-0.004-0.029-0.023-0.016-0.016-0.045c0.006-0.028-0.037,0-0.018-0.049c0.009-0.024-0.028-0.063,0.015-0.099   c0.02-0.018,0.025-0.026,0.049-0.02c0.024,0.008,0.011-0.004,0.008-0.065c-0.014,0.04-0.029,0.045-0.079,0.073   c-0.006-0.032,0.022-0.066-0.03-0.06c-0.026,0.003-0.027-0.011-0.035-0.025c-0.008-0.014-0.023-0.028-0.079-0.024   c-0.054,0.003-0.098,0.013-0.079,0.023c0.019,0.011-0.031,0.019-0.092,0.096c-0.035,0.044,0.015,0.036,0.003,0.06   c-0.013,0.024,0.05,0.017,0.016,0.061c-0.038,0.046-0.092,0.044-0.108,0.01c-0.015-0.034-0.034-0.058-0.012-0.079   c-0.04,0.005-0.01,0.044-0.043,0.046c-0.035,0.002-0.012-0.029-0.053-0.051c-0.039-0.024-0.022-0.059-0.086-0.067   c-0.062-0.008-0.026-0.039-0.051-0.016l-0.03,0.004c-0.009-0.005-0.016-0.009-0.019,0.008c-0.006,0.03-0.009,0.022-0.021,0.019   c-0.013-0.004,0.002-0.033-0.024-0.039c-0.04-0.007,0.024-0.025-0.01-0.045c-0.033-0.018-0.055-0.01-0.027,0.008   c0.027,0.018-0.002,0.024-0.034,0.013c-0.031-0.011-0.036-0.019-0.003-0.048c0.009-0.008-0.025-0.025-0.004-0.044   c-0.067-0.05-0.086-0.077-0.15-0.106c-0.064-0.03,0.034-0.021-0.036-0.057c-0.071-0.037-0.042-0.003-0.021,0.01   c0.021,0.013,0.023,0.057-0.037,0.021c-0.061-0.036-0.07-0.041-0.045-0.076c0.008-0.013-0.019-0.048-0.01-0.067   c0.009-0.021-0.066-0.028-0.035-0.038c0.029-0.011,0.054-0.008,0.033-0.029c-0.055-0.053,0.018-0.047-0.072-0.105   c-0.092-0.057-0.073-0.188-0.134-0.247c-0.061-0.057,0.016-0.061,0.027-0.043l-0.014-0.021c-0.033-0.011,0.01-0.063-0.061-0.035   c-0.18,0.075-0.166-0.003-0.261-0.016c-0.093-0.013-0.047-0.019-0.114-0.034c-0.144-0.032-0.157-0.011-0.257-0.162   c-0.02-0.03-0.009-0.045-0.12-0.146c-0.121-0.11-0.151-0.065-0.186-0.096c0.049-0.005,0.049-0.052,0.013-0.033   c-0.017,0.008-0.027,0.006-0.036,0.003l-0.034,0.01c-0.028,0.027,0.076,0.019-0.004,0.028c-0.08,0.008-0.034,0.037-0.116,0.038   c-0.082,0-0.07,0.079-0.179-0.009c-0.032,0.026-0.108,0.008-0.139-0.028c-0.029-0.036-0.062-0.008-0.109-0.07   c-0.027-0.034-0.108-0.021-0.14-0.03c0.022-0.244,0.044-0.493,0.083-0.733c0.04-0.242,0.077-0.478,0.134-0.715   c0.073-0.309,0.13-0.535,0.184-0.71C1.129,8.373,1.19,8.128,1.279,7.899c0.088-0.227,0.17-0.471,0.274-0.694   c0.103-0.222,0.194-0.436,0.312-0.654C1.983,6.336,2.096,6.112,2.227,5.9c0.13-0.211,0.259-0.422,0.402-0.627   C2.771,5.069,2.925,4.867,3.08,4.67c0.153-0.198,0.33-0.404,0.494-0.595c0.164-0.189,0.405-0.4,0.578-0.582   c0.175-0.18,0.292-0.264,0.475-0.437l0.082-0.061c0.106,0.002,0.258,0,0.317,0.037C5.073,3.06,5.072,3.051,5.087,3.04   c0.009-0.006,0.023-0.011,0.054-0.01c0.032,0.002,0.046-0.009,0.054-0.02c0.013-0.017,0.008-0.036,0.035,0   c0.043,0.056,0.075,0.064,0.074,0.025c0-0.039-0.053,0.004-0.08-0.076C5.273,2.974,5.29,2.966,5.298,2.957   c0.01-0.01,0.009-0.02,0.032,0.002c0.044,0.043,0.105,0.008,0.047,0.047C5.318,3.046,5.399,3.03,5.308,3.092   C5.429,3.06,5.354,3.045,5.431,2.998c0.027-0.015,0.044-0.008,0.072,0c0.021,0.006,0.048,0.012,0.091,0.007   c0.101-0.009,0.164-0.029,0.13-0.046C5.707,2.951,5.701,2.959,5.693,2.967C5.686,2.974,5.678,2.983,5.658,2.973   C5.62,2.954,5.724,2.905,5.767,2.919c0.022,0.008,0.123-0.045,0.111-0.05C5.865,2.863,5.831,2.874,5.796,2.886   C5.754,2.898,5.709,2.91,5.687,2.897C5.67,2.887,5.661,2.892,5.652,2.896C5.639,2.902,5.625,2.908,5.583,2.864   C5.51,2.785,5.728,2.8,5.702,2.753c-0.015-0.026,0.046-0.04,0.098-0.074C5.827,2.661,5.833,2.664,5.84,2.668   C5.848,2.67,5.856,2.674,5.883,2.662c0.058-0.026-0.107-0.008,0.061-0.055c0.073-0.021,0.157,0.02,0.136,0.05   c-0.042,0.059,0.084,0.073,0.031,0.1C6.072,2.777,6.069,2.769,6.063,2.761C6.06,2.754,6.055,2.747,6.029,2.756   c-0.057,0.021,0.07,0.025-0.04,0.087c0.059-0.006,0.138,0.004,0.043,0.079c0.041-0.005,0.099,0.003,0.15-0.049   C6.231,2.82,6.335,2.9,6.262,2.939c-0.073,0.04,0.002,0.067-0.031,0.124c0.158-0.124,0.237-0.102,0.285-0.141   c0.049-0.039,0.059-0.049,0.103-0.056C6.522,2.851,6.664,2.756,6.743,2.784c0.081,0.029,0.136,0.01,0.182,0.031   C6.969,2.838,7.049,2.872,7,2.882c-0.05,0.01-0.012,0.044-0.087,0.034c-0.058-0.008-0.02,0.027-0.036,0.04   C6.819,3.012,6.946,3.008,6.826,3.072c-0.07,0.039-0.097,0.034-0.124,0.029C6.683,3.098,6.664,3.095,6.63,3.109   C6.588,3.128,6.568,3.127,6.551,3.126C6.536,3.126,6.523,3.125,6.495,3.14C6.446,3.163,6.426,3.092,6.368,3.089   c0.013,0.005,0.028,0.014,0.043,0.037c0.026,0.041,0.023,0.039,0,0.038C6.399,3.162,6.379,3.162,6.355,3.17   C6.304,3.182,6.3,3.166,6.294,3.15C6.287,3.129,6.278,3.108,6.176,3.146C6.062,3.188,6.361,3.17,6.092,3.242   C5.93,3.286,5.983,3.3,5.868,3.291C5.754,3.283,5.855,3.206,5.681,3.219c0.123,0.017,0.067,0.065,0.154,0.085   c0.034,0.008,0.068,0.008,0.091,0.008C5.964,3.31,5.976,3.31,5.918,3.34C5.824,3.389,5.771,3.439,5.7,3.437   c-0.021-0.001-0.04,0.002-0.057,0.005C5.605,3.449,5.577,3.455,5.549,3.42C5.542,3.478,5.518,3.452,5.46,3.469   C5.434,3.476,5.417,3.47,5.385,3.463C5.346,3.456,5.282,3.448,5.149,3.467c0.111,0.002,0.125,0.005,0.066,0.03   c0.115-0.041,0.146-0.022,0.162,0.01c0.015,0.03,0.017,0.061-0.115,0.05C5.071,3.541,5.272,3.583,5.186,3.6   C5.04,3.627,5.076,3.661,5.02,3.668C4.963,3.676,4.851,3.762,4.812,3.759C4.742,3.753,4.861,3.773,4.666,3.84   C4.594,3.864,4.69,3.87,4.603,3.884C4.517,3.9,4.633,3.889,4.537,3.941c-0.095,0.052-0.029,0.091-0.14,0.152   C4.445,4.086,4.445,4.08,4.442,4.136c0.027-0.039,0.042-0.022,0.095-0.033c0.05-0.014,0.056,0.05,0.045,0.069   c-0.011,0.019,0.022,0.076,0,0.092C4.537,4.298,4.521,4.296,4.508,4.296C4.493,4.295,4.481,4.294,4.445,4.327   C4.47,4.311,4.472,4.313,4.487,4.314c0.008,0.001,0.019,0.002,0.039,0c0.057-0.004,0.213-0.088,0.23-0.023   C4.773,4.356,4.958,4.325,4.973,4.38c0.007,0.031,0.013,0.03,0.027,0.028c0.011-0.002,0.025-0.002,0.048,0.011   C5.13,4.471,5.184,4.412,5.16,4.482c-0.008,0.023,0.052,0.02,0.112,0.016c0.051-0.002,0.101-0.006,0.112,0.008   c0.011,0.012,0.038,0.011,0.06,0.01c0.031-0.001,0.052-0.002,0.008,0.03C5.374,4.601,5.453,4.581,5.42,4.627   C5.402,4.653,5.395,4.65,5.387,4.646L5.361,4.651C5.337,4.679,5.324,4.654,5.263,4.644c0.034,0.06,0.124,0.004,0.117,0.068   C5.372,4.776,5.384,4.758,5.3,4.769C5.457,4.79,5.352,4.905,5.398,4.928c0.041,0.02-0.027,0.021-0.068,0.065   C5.35,4.979,5.379,4.977,5.419,4.95c0.029-0.019,0.032,0.011,0.03,0.041C5.447,5.017,5.442,5.043,5.449,5.036L5.482,5.04   c0.019,0.006,0.036,0.013,0.019-0.013C5.485,5.004,5.549,5.005,5.603,4.979c0.051-0.025-0.009,0.054,0.076,0.094   C5.623,5.026,5.666,5.014,5.711,5.015C5.67,4.993,5.66,4.998,5.666,4.95c0.004-0.041,0.15,0.001,0.146-0.122   C5.811,4.768,5.833,4.775,5.835,4.748C5.842,4.628,5.831,4.63,5.82,4.633L5.808,4.621C5.801,4.577,5.748,4.61,5.78,4.569   c0.019-0.025,0.316-0.011,0.529-0.225c0.264-0.264-0.042-0.28,0.022-0.32c0.036-0.024-0.058-0.039,0.104-0.087   c0.11-0.032,0.014-0.019,0.081-0.04c0.084-0.027-0.05-0.023,0.055-0.084c0.14-0.082-0.064-0.015,0.061-0.099   c0.07-0.048,0.033-0.141,0.113-0.179C6.825,3.493,6.937,3.53,7.016,3.56c0.072,0.027,0.107,0.01,0.136-0.007   c0.04-0.023,0.072-0.047,0.178,0.042C7.316,3.678,7.367,3.656,7.395,3.682c0.029,0.027,0.04,0.017,0.052,0.007   c0.009-0.007,0.017-0.014,0.034-0.007C7.519,3.7,7.454,3.713,7.483,3.736c0.014,0.012,0.033,0.003,0.05-0.007   c0.017-0.009,0.031-0.017,0.039-0.008c0.017,0.016,0.032,0.032-0.055,0.052C7.381,3.802,7.614,3.831,7.408,3.858   c0,0,0.059,0.002,0.062,0.021c0.009,0.068-0.154,0.063-0.139,0.122C7.45,3.944,7.507,3.977,7.455,4.027   c-0.069,0.066-0.1,0.054-0.096,0.011C7.334,4.073,7.34,4.081,7.286,4.095c0.038-0.002,0.083-0.002,0.06,0.045   c0.093-0.092,0.222-0.13,0.205-0.078C7.541,4.09,7.553,4.089,7.567,4.087l0.025,0.012c0.013-0.057,0.104-0.065,0.15-0.119   c0.025-0.031,0.029-0.008,0.03,0.015C7.773,4.012,7.773,4.03,7.781,4.023C7.803,4.01,7.777,3.967,7.858,3.944   c0.093-0.028-0.003-0.072,0.064-0.099c0.075-0.031,0.086-0.129,0.116-0.079c0.03,0.05,0.067,0.031,0.056,0.063   C8.085,3.862,8.125,3.856,8.113,3.891C8.099,3.926,8.159,3.92,8.14,3.96C8.121,4.001,8.212,4.006,8.168,4.073   c0.098,0.033,0.048,0.102-0.083,0.115C8.113,4.2,8.14,4.195,8.215,4.174c0.076-0.021-0.056,0.06,0,0.097   c0.056,0.037-0.029,0.147,0.041,0.112c0.039-0.019,0.03-0.003,0.027,0.013c-0.002,0.012,0,0.024,0.031,0.021   c0.037-0.005,0.038,0.003,0.037,0.011c0,0.007-0.002,0.015,0.023,0.012C8.399,4.438,8.403,4.449,8.407,4.46   c0.003,0.011,0.007,0.021,0.03,0.019c0.047-0.004,0.157,0.017,0.059,0.032C8.398,4.527,8.351,4.559,8.245,4.559   C8.099,4.56,8.268,4.566,8.117,4.621C8.2,4.63,8.308,4.601,8.384,4.57C8.46,4.538,8.49,4.524,8.533,4.556   c0.044,0.032-0.025,0.027-0.001,0.046c0.023,0.02,0.018-0.008,0.073-0.012c0.057-0.004,0.08,0.054,0.028,0.074   C8.584,4.685,8.677,4.715,8.643,4.718C8.605,4.722,8.743,4.76,8.594,4.83c-0.071,0.034-0.08,0.03-0.088,0.026   C8.498,4.852,8.491,4.848,8.407,4.893C8.343,4.928,8.305,4.914,8.315,4.945L8.31,4.954C8.3,4.95,8.279,4.947,8.251,4.98   l-0.015,0.02c0-0.002-0.012-0.014-0.148,0.042C7.968,5.09,7.956,5.08,7.933,5.071C7.916,5.063,7.892,5.055,7.807,5.074   C7.733,5.09,7.739,5.083,7.719,5.076C7.698,5.068,7.65,5.06,7.474,5.076C7.214,5.1,7.147,5.112,7.149,5.151   c0.002,0.041-0.068,0.048-0.152,0.066C6.912,5.235,6.922,5.291,6.874,5.266c-0.02-0.011-0.012,0.029-0.069,0.04   C6.705,5.323,6.54,5.491,6.47,5.512C6.4,5.532,6.436,5.556,6.332,5.616c0.049-0.02,0.063-0.011,0.161-0.086   c0.099-0.075,0.501-0.238,0.648-0.264c0.147-0.024,0.224,0.009,0.214,0.04C7.35,5.327,7.346,5.321,7.342,5.316L7.326,5.313   C7.307,5.327,7.36,5.337,7.342,5.349C7.3,5.373,7.297,5.347,7.211,5.398C7.168,5.423,7.154,5.421,7.139,5.42   c-0.014-0.002-0.031-0.003-0.075,0.02C7.108,5.43,7.112,5.437,7.126,5.447l0.032-0.001c0.016-0.003,0.032-0.007,0.04,0.003   c0.013,0.019-0.002,0.059-0.08,0.084C7.153,5.53,7.19,5.601,7.204,5.688c0.09,0,0.028,0.055,0.142,0.061   c0.114,0.007-0.011,0.073,0.096,0.02c0.057-0.029,0.05-0.017,0.045-0.004C7.481,5.776,7.477,5.786,7.514,5.77   C7.56,5.749,7.556,5.782,7.556,5.782s-0.02,0.058-0.081,0.07c-0.06,0.011-0.108,0.093-0.173,0.067   C7.269,5.906,7.27,5.918,7.269,5.928C7.266,5.94,7.26,5.951,7.214,5.94C7.122,5.918,7.18,5.967,7.098,5.971   C7.018,5.976,7.113,6.009,7.052,6.027c-0.061,0.017-0.13,0.08-0.147,0.062C6.888,6.07,6.899,6.117,6.874,6.125   C6.827,6.106,6.855,6.073,6.843,6.065c-0.037-0.024,0.009-0.07,0.107-0.15c0.069-0.056,0.138-0.054,0.17-0.051l0.018-0.002   c-0.009-0.011,0.029,0,0.139-0.029C7.231,5.841,7.181,5.852,7.14,5.837C7.118,5.829,7.09,5.836,7.065,5.844   C7.043,5.85,7.024,5.857,7.016,5.853c-0.019-0.01,0.152-0.057,0.057-0.107c0.017,0.035,0.02,0.039-0.096,0.097   C6.916,5.874,6.881,5.871,6.859,5.868c-0.02-0.003-0.03-0.006-0.041,0.015c0.029,0.024-0.171,0.102-0.171,0.102   S6.568,5.933,6.542,6.01C6.524,6.061,6.517,6.039,6.511,6.017C6.506,6,6.503,5.983,6.494,6.001C6.455,6.08,6.442,6.073,6.425,6.065   C6.414,6.061,6.402,6.056,6.382,6.07C6.33,6.109,6.273,6.077,6.22,6.153C6.166,6.229,6.18,6.188,6.137,6.239   C6.092,6.29,6.082,6.301,6.101,6.353C6.11,6.376,6.13,6.373,6.143,6.371C6.16,6.367,6.168,6.364,6.132,6.41   C6.11,6.366,6.009,6.408,6.009,6.408s-0.066,0.073-0.11,0.057c-0.06-0.022,0.006,0.014-0.112,0.016   c-0.117,0.002-0.115,0.07-0.166,0.08C5.591,6.565,5.598,6.583,5.583,6.592c-0.045,0.028,0.045,0-0.02,0.055   C5.524,6.679,5.51,6.679,5.485,6.712C5.46,6.745,5.445,6.726,5.409,6.698C5.42,6.715,5.413,6.722,5.451,6.75   c-0.025,0.019-0.034,0.013-0.04,0.01C5.403,6.755,5.4,6.75,5.384,6.776C5.351,6.824,5.352,6.778,5.3,6.843   c-0.026,0.031-0.034,0.07-0.041,0.023C5.252,6.819,5.22,6.838,5.202,6.778C5.2,6.812,5.174,6.813,5.221,6.838   c0.047,0.025-0.014,0.027,0.031,0.056C5.296,6.922,5.22,7.015,5.189,7.046C5.182,7.053,5.198,7.028,5.212,7.001   c0.017-0.03,0.032-0.06,0.01-0.04C5.182,6.999,5.153,7.096,5.107,7.118C5.062,7.14,5.072,7.115,5.113,7.069   c0.041-0.046-0.041-0.055-0.012-0.09c0.028-0.034-0.035-0.031-0.006-0.075c0.028-0.043-0.029-0.014,0.03-0.059   C5.183,6.802,5.119,6.819,5.069,6.85C5.02,6.879,5.045,6.955,5.018,6.925c0.035,0.058-0.005,0.049-0.034,0.036   C5.052,6.999,5.006,7,5.04,7.044L5.017,7.043C5.009,7.046,5.002,7.047,4.978,7.036c0.013,0.029,0.083,0.035,0.021,0.078   C5.061,7.08,5.024,7.179,5.04,7.228c0.016,0.051,0.019,0.127-0.023,0.123l-0.038,0C4.954,7.353,4.933,7.354,4.922,7.335   C4.908,7.362,4.886,7.379,4.95,7.374c0.025-0.002,0.032,0.004,0.034,0.009C4.986,7.392,4.975,7.4,4.992,7.381   C5.02,7.351,5.035,7.393,4.999,7.42c-0.033,0.026,0,0.041-0.093,0.015C4.81,7.41,4.929,7.445,4.889,7.474   c-0.036,0.025-0.012,0.02,0.009,0.014h0.016C4.882,7.509,4.898,7.553,4.821,7.56c-0.08,0.007-0.101,0.085-0.128,0.071   c-0.014-0.006-0.04,0.022-0.069,0.05C4.595,7.709,4.563,7.737,4.541,7.731C4.487,7.717,4.419,7.776,4.406,7.799   c-0.05,0.086-0.042,0.038-0.081,0.075C4.25,7.941,4.231,7.93,4.223,7.919L4.216,7.913C4.191,7.953,4.159,7.942,4.141,7.93   c-0.017-0.01-0.023-0.021-0.007,0.004c0.034,0.052-0.017,0.043-0.011,0.061C4.137,8.04,4.107,7.99,4.054,8.055   c-0.176,0.214-0.107,0.21-0.139,0.251C3.883,8.345,3.905,8.475,3.917,8.556C3.924,8.6,3.927,8.594,3.928,8.588   c0.001-0.006,0.001-0.011,0.003,0.016c0,0.057,0.023,0.168,0.009,0.171C3.935,8.777,3.931,8.75,3.925,8.724   c-0.007-0.04-0.012-0.081-0.012-0.024c0,0.096,0.051,0.15,0.044,0.182c0.035,0.031-0.004,0.129-0.049,0.215   C3.863,9.181,3.919,9.136,3.884,9.17C3.866,9.189,3.859,9.186,3.854,9.181L3.839,9.186C3.826,9.204,3.822,9.202,3.815,9.201   C3.81,9.199,3.8,9.198,3.783,9.207C3.747,9.222,3.723,9.208,3.714,9.194C3.707,9.18,3.711,9.168,3.729,9.176   c0.038,0.018-0.002-0.019,0.035-0.03C3.8,9.135,3.727,9.128,3.716,9.091C3.705,9.055,3.652,9.098,3.658,9.002   C3.659,8.957,3.637,8.95,3.659,8.92c0.023-0.03-0.003-0.032-0.025-0.013C3.572,8.761,3.636,8.775,3.613,8.734   C3.59,8.693,3.728,8.549,3.669,8.516c-0.059-0.033-0.022-0.085-0.07-0.091C3.551,8.418,3.573,8.339,3.478,8.399   C3.419,8.436,3.403,8.431,3.391,8.426C3.383,8.423,3.377,8.42,3.361,8.428c-0.04,0.019-0.068,0.004-0.034-0.012   c0.034-0.017-0.014-0.027-0.156-0.06C3.03,8.323,3.267,8.327,3.234,8.317C3.201,8.307,3.067,8.313,3.099,8.33   c0.033,0.018-0.101,0.033-0.133-0.005C2.962,8.343,2.975,8.339,2.908,8.361C2.84,8.383,2.866,8.316,2.866,8.316   S2.851,8.304,2.855,8.361c0.002,0.028-0.032,0.024-0.063,0.02C2.775,8.379,2.758,8.377,2.749,8.38   C2.705,8.397,2.678,8.385,2.658,8.373C2.635,8.359,2.621,8.345,2.606,8.378C2.573,8.45,2.727,8.39,2.685,8.455   c-0.013,0.021,0.051,0.028,0.03,0.047C2.693,8.521,2.786,8.537,2.728,8.551c-0.059,0.014-0.04,0.004-0.063-0.016L2.64,8.542   C2.631,8.553,2.62,8.563,2.598,8.539C2.573,8.513,2.482,8.536,2.464,8.505L2.452,8.497C2.449,8.501,2.444,8.505,2.426,8.485   C2.39,8.446,2.409,8.475,2.359,8.491C2.32,8.504,2.294,8.488,2.266,8.471c-0.04-0.025-0.085-0.048-0.184,0.012   C2.009,8.525,1.948,8.582,1.977,8.545C2.005,8.507,1.961,8.51,2.009,8.462C1.91,8.509,1.969,8.51,1.941,8.533   c-0.027,0.021,0.061,0.03-0.044,0.055c-0.061,0.015-0.085,0.08-0.106,0.06L1.759,8.652L1.726,8.657   C1.707,8.645,1.704,8.655,1.702,8.664L1.695,8.677L1.691,8.702c-0.002,0.02-0.009,0.041-0.049,0.011   c0.013,0.025-0.019,0.075-0.064,0.088C1.557,8.807,1.533,8.869,1.513,8.86c-0.042-0.021,0.006,0.01-0.037,0.016   C1.433,8.883,1.466,8.866,1.449,8.939C1.431,9.012,1.385,9.005,1.407,9.036c0.02,0.031-0.011,0.027-0.018,0.104   C1.386,9.176,1.394,9.209,1.321,9.292c-0.097,0.113-0.053,0.321-0.128,0.42c-0.075,0.1,0.047,0.16,0.003,0.223   c-0.044,0.063,0.036,0.178,0.074,0.261c0.038,0.083-0.007,0.089,0.041,0.103c0.048,0.015-0.023,0.09,0.062,0.085   c0.051-0.004,0.044,0.018,0.076,0.022c0.029,0.005,0.065,0.065,0.137,0.011c0.071-0.052,0.116-0.019,0.194-0.055   c0.076-0.038,0.095-0.012,0.141-0.042c0.046-0.029,0.08-0.011,0.036,0.002c-0.042,0.013-0.046,0.048,0.026,0.013   c0.095-0.048-0.048-0.028,0.069-0.074c0.048-0.019,0.001-0.113,0.075-0.129c0.031-0.007,0.017-0.081,0.022-0.165   c0.004-0.08,0.224-0.11,0.24-0.1c0.017,0.01,0.04,0.002,0.072-0.006C2.49,9.856,2.528,9.849,2.572,9.855   C2.609,9.861,2.629,9.856,2.64,9.851c0.019-0.007,0.02-0.015,0.042,0.018c0.018,0.027,0.025,0.027,0.031,0.027   c0.004-0.001,0.008-0.001,0.021,0.028c0.023,0.057-0.048,0.079-0.073,0.125c-0.025,0.045-0.005,0.089-0.066,0.087l-0.016,0.009   l0.016,0.007c0.012-0.005,0.052-0.003-0.008,0.056c-0.059,0.058-0.065,0.17-0.092,0.189c-0.028,0.018,0.008,0.096-0.037,0.107   c0.019-0.089-0.022-0.06-0.011-0.131c-0.015,0.038-0.049,0.043-0.043,0.06c0.089-0.016-0.017,0.1-0.006,0.157   c0.012,0.057-0.036,0.109-0.077,0.159c-0.04,0.05-0.07,0.03-0.061,0.09c-0.002,0.02-0.002,0.016,0.004,0.011   c0.007-0.005,0.019-0.01,0.044,0.012c0.046,0.041,0.028,0.002,0.08-0.002c0,0-0.011-0.047,0.067-0.011   c0.036,0.017,0.095,0.006,0.155-0.004c0.06-0.011,0.119-0.021,0.157-0.004c0.021,0.009,0.022,0.005,0.022,0.001l0.008-0.002   l0.02,0.001c0.013-0.002,0.033-0.004,0.09,0.019c0.089,0.033,0.027,0.009-0.013,0.028c-0.021,0.01-0.025,0.01-0.018,0.009   c0.009,0,0.034,0,0.064,0.017c0.044,0.026,0.037,0.012,0.03-0.002c-0.008-0.013-0.014-0.027,0.026-0.005   c0.081,0.045,0.057,0.068,0.082,0.08c0.025,0.013-0.075,0.051-0.02,0.066c0.036,0.012-0.002,0.125-0.043,0.128   c0.033,0.013,0.009,0.034-0.011,0.104c-0.019,0.067-0.012,0.08-0.012,0.112c-0.002,0.031-0.05,0.057-0.029,0.044   c0.02-0.014,0.015,0,0.012,0.023c-0.002,0.024,0.006,0.063-0.009,0.043c-0.009-0.011-0.015,0.005-0.015,0.022l0.015,0.025   c0.011-0.003,0.023,0.062-0.01,0.075c-0.046,0.022-0.012,0.118-0.001,0.145c-0.008,0.003,0.019-0.005,0.016,0.045   c-0.004,0.049,0.066,0.131,0.098,0.163c0.03,0.031,0.061,0.032,0.046,0.043c-0.031,0.021-0.007,0.011,0.006,0.021   c0.012,0.011-0.049,0.023,0.003,0.042c0.052,0.018,0.002-0.016,0.021-0.035c0,0,0.046,0.035,0.056,0.053   c0.009,0.018,0.126,0.017,0.15-0.001c0.039-0.03,0.091-0.006,0.118-0.041c0.018-0.022,0.039-0.019,0.016,0.032L3.47,12.119   c0.006-0.005,0.019-0.014,0.051-0.018c0.074-0.011,0.013-0.014-0.008-0.035c-0.022-0.022,0.021-0.051,0.042-0.063   c0.022-0.013,0.059-0.015,0.083-0.002c0.017,0.009,0.021,0.009,0.028,0.009c0.008-0.001,0.018-0.001,0.074,0.033   c0.091,0.056,0.009,0.01,0.039,0.051c0.03,0.04,0.031-0.008,0.071,0.058c0.021,0.035,0.045,0.008,0.107,0.113   c-0.019-0.036-0.021-0.035-0.016-0.034c0.004,0,0.013,0.001,0.022-0.016c0.022-0.041-0.048-0.03-0.032-0.048   c0.014-0.02,0.045,0.002,0.082-0.077c0.027-0.059,0.057-0.056,0.074-0.053l0.011,0c0.063-0.055-0.006-0.042,0.021-0.082   c0.037-0.056-0.005-0.108,0.019-0.122c0.046-0.026,0.045-0.07,0.126-0.097c0.124-0.042-0.015,0.032,0.064,0.039   c-0.019-0.004,0.049-0.094,0.089-0.094c0.058,0,0.055-0.019,0.199-0.088c0.144-0.07,0.013-0.096,0.084-0.096   c0.07,0,0.021-0.032,0.091-0.013c0.07,0.018,0.068,0.051,0.009,0.095c-0.011,0.005,0.024,0.014-0.043,0.04   c-0.083,0.032,0.02,0.1,0.028,0.118c0.024,0.052,0.006,0.046-0.011,0.04c-0.015-0.005-0.029-0.011-0.005,0.031   c0.033,0.061-0.083,0.054-0.104,0.118c-0.02,0.062,0.078,0.056,0.074,0.096c-0.006,0.058,0.119,0.014,0.119-0.006   c0-0.104-0.03-0.141-0.03-0.141s-0.049-0.016-0.022-0.047c0.028-0.032-0.012-0.03,0.034-0.086c0.047-0.055,0.064-0.06,0.132-0.08   c0.067-0.018,0.024-0.053,0.061-0.039c0.018,0.006,0.027-0.005,0.027-0.016c0-0.012-0.011-0.023-0.036-0.014   c-0.049,0.018-0.039,0.002-0.037-0.043c0.003-0.045,0.081-0.049,0.084,0.016c0.003,0.063,0.012,0.038,0.081,0.061   c0.037,0.013,0.047,0.011,0.054,0.008c0.005-0.002,0.009-0.004,0.026,0.005c0.035,0.019,0.094,0.068,0.051,0.083   c-0.042,0.016,0.013,0.067,0.144,0.051c0.131-0.016,0.252-0.005,0.227,0.027c-0.026,0.032,0.023,0.061,0.176,0.043   c0.153-0.018,0.04-0.061,0.154-0.073c-0.128-0.015-0.064-0.033,0.016-0.021c0.04,0.007,0.053,0.003,0.068-0.001   c0.013-0.003,0.026-0.007,0.064-0.002c0.048,0.007,0.074,0.007,0.088,0.007l0.016,0.002c0.008,0.018-0.059,0.023-0.139,0.023   c-0.08,0-0.054,0.024-0.019,0.019c0.037-0.005,0.012,0.013,0.08,0.111c0.021-0.031,0.076,0,0.098,0.029   c0.022,0.029,0.108,0.052,0.097,0.115c-0.005,0.035,0.05,0.014,0.025,0.033c-0.025,0.019,0.027,0,0.027,0.029   c0,0.03,0.03,0.056-0.077,0.051c0.055,0.023,0.077,0.016,0.092,0.009c0.02-0.009,0.024-0.018,0.079,0.048   c0.068-0.034,0.084,0,0.184,0.084c0.102,0.083,0.104,0.083,0.052,0.185c0.034-0.016,0.019-0.043,0.096,0.014   c0.076,0.056,0.015,0.079,0.076,0.089c0.061,0.012-0.036,0.154-0.036,0.156c0,0.002,0.022-0.02,0.067-0.081   c0.026-0.034,0.065-0.018,0.104-0.002c0.033,0.013,0.065,0.027,0.089,0.013c0.03-0.016,0.048-0.01,0.06-0.004l0.023,0.004   c0.023-0.017,0.044-0.016,0.062-0.013l0.033-0.003c0.017-0.017,0.127,0.014,0.125,0.042c0.009-0.01,0.033-0.026,0.055,0.009   c0.021,0.035,0.083,0.019,0.125,0.077c0.021,0.027,0.028,0.022,0.033,0.018c0.006-0.005,0.009-0.009,0.025,0.019   c0.031,0.057,0.043,0.017,0.052,0.057c0.009,0.041,0.028,0.018,0.046,0.081c0,0,0.018-0.026,0.064,0.055   c0.022,0.039,0.025,0.027,0.025,0.016c0-0.012-0.004-0.024,0.008,0.026c0.028,0.11,0.105,0.357,0.115,0.359   c0.088,0.017,0.107,0.112,0.041,0.159c-0.067,0.049-0.03,0.086-0.104,0.13c-0.073,0.042-0.066,0.111-0.081,0.208   c-0.006,0.044-0.044,0.083-0.076,0.105c0.049,0.012,0.08,0.128,0.08,0.128s-0.01-0.054-0.016-0.113   c-0.007-0.059,0.094-0.044,0.12-0.112c0.028-0.07-0.027-0.05,0.034-0.132c0.041-0.056,0.054-0.048,0.09-0.04   c0.018,0.004,0.04,0.008,0.074,0.005c0.104-0.01,0.226-0.02,0.178,0.04c-0.049,0.058,0.031,0.048-0.061,0.12   c-0.091,0.073,0.01,0.076-0.045,0.109c-0.026,0.018-0.041,0.017-0.057,0.016c-0.017,0-0.036,0-0.074,0.023   c-0.035,0.02-0.044,0.016-0.055,0.01c-0.011-0.004-0.026-0.009-0.079,0.015c0.029-0.004,0.043,0.005,0.055,0.013   c0.019,0.014,0.032,0.028,0.092-0.006c0.119-0.071-0.025,0.027,0.071,0.136c-0.035-0.135,0.041-0.178,0.081-0.172   c0.04,0.006-0.006-0.116,0.133-0.153c0.139-0.037,0.141,0.046,0.336,0.139c0.196,0.093,0.154,0.11,0.108,0.131   c-0.046,0.021,0.076,0.017,0.028,0.119c0.073-0.069,0.061-0.076,0.158-0.015c0.125,0.077,0.298,0.117,0.327,0.104   c0.101-0.041,0.169-0.013,0.285,0.085c0.115,0.097,0.226,0.126,0.301,0.202c0.031,0.033,0.081,0.03,0.132,0.026   c0.066-0.004,0.132-0.008,0.16,0.068c0.033,0.09,0.104,0.202,0.089,0.309C10.295,15.188,10.332,15.384,10.252,15.475z M6.317,3.426   C6.294,3.43,6.275,3.433,6.286,3.429c0.026-0.012,0.04-0.044-0.014-0.018C6.247,3.422,6.23,3.42,6.218,3.417   C6.203,3.414,6.194,3.411,6.182,3.433C6.16,3.471,6.117,3.475,6.075,3.477C6.033,3.478,6.025,3.52,5.983,3.539   C5.939,3.558,5.901,3.561,5.864,3.558C5.827,3.556,5.839,3.543,5.874,3.524C5.909,3.503,5.906,3.489,5.86,3.5   C5.812,3.511,5.744,3.513,5.757,3.498C5.769,3.483,5.795,3.46,5.933,3.431C5.914,3.386,5.99,3.354,6.04,3.321   c0.05-0.032,0.084-0.061,0.13-0.079c0.044-0.018,0.06,0.008,0.042,0.018C6.195,3.271,6.189,3.33,6.213,3.3   c0.025-0.032,0.086-0.041,0.085-0.015C6.297,3.311,6.393,3.304,6.386,3.339C6.38,3.372,6.399,3.384,6.435,3.39   c0.037,0.006,0.07,0.037,0.043,0.047C6.45,3.449,6.554,3.435,6.497,3.47C6.439,3.505,6.45,3.478,6.405,3.471   C6.359,3.463,6.3,3.473,6.341,3.45C6.409,3.413,6.358,3.419,6.317,3.426z M7.755,5.684c-0.017,0.011,0.033,0.032,0.001,0.04   C7.724,5.732,7.708,5.746,7.689,5.742L7.656,5.751L7.624,5.76L7.602,5.762C7.588,5.766,7.574,5.77,7.575,5.753   c0.001-0.042-0.004-0.053,0.022-0.066c0.026-0.014,0.086-0.073,0.108-0.08l0.006,0.008l0.004,0.008   c0.012-0.005,0.009,0.04-0.015,0.053C7.738,5.672,7.773,5.672,7.755,5.684z M7.444,5.704C7.417,5.718,7.412,5.709,7.408,5.7   L7.395,5.689L7.372,5.684l-0.01,0.001C7.364,5.705,7.365,5.7,7.338,5.69l-0.03-0.003L7.295,5.68C7.3,5.664,7.31,5.661,7.284,5.669   c-0.025,0.008-0.024,0-0.021-0.013L7.255,5.64C7.24,5.653,7.237,5.67,7.235,5.634c-0.003-0.031,0.008-0.072,0.028-0.04   c0.02,0.032,0.059,0.019,0.059,0.04l0.01,0.006l0.021,0c0.021,0.008,0.042,0.012,0.078,0.005C7.468,5.638,7.51,5.626,7.484,5.647   C7.459,5.669,7.47,5.674,7.441,5.675C7.412,5.675,7.492,5.677,7.444,5.704z M5.569,10.382c0.037-0.01-0.003-0.019,0.035-0.022   c0.102-0.003,0.078,0.006,0.118,0.01c0.017,0.001,0.029,0,0.039-0.001l0.028,0.001c0.017,0.004,0.042,0.028,0,0.034   c-0.03,0.004-0.011,0.018-0.033,0.028C5.734,10.445,5.722,10.44,5.7,10.433l-0.041,0.002l-0.032,0.004H5.604H5.574   c-0.02-0.005,0.009-0.031,0.009-0.043C5.584,10.385,5.552,10.385,5.569,10.382z M5.009,10.417   c-0.022,0.007-0.032,0.018-0.046,0.039c-0.012,0.02-0.041,0.027-0.042,0.012c-0.003-0.015-0.026-0.007-0.046-0.002   c-0.02,0.004,0.005-0.021,0.007-0.036L4.873,10.41c-0.008-0.007-0.021-0.013-0.04-0.018c-0.036-0.009-0.069-0.002-0.11,0.006   c-0.041,0.009-0.05-0.013-0.082-0.014c-0.032-0.002-0.047,0.002-0.056,0.016l-0.024,0c-0.006-0.01-0.026-0.02-0.055-0.025   C4.479,10.374,4.509,10.36,4.5,10.338c-0.007-0.022,0.044-0.02,0.055-0.015h0.03l0.034,0.003l0.021,0.001l0.033-0.003   c0.034,0.003,0.04-0.005,0.065-0.013c0.025-0.009,0.061-0.004,0.061-0.004s-0.018-0.016-0.045-0.032   c-0.027-0.017,0.006-0.02-0.024-0.041c-0.028-0.021,0.007-0.032,0.002-0.038c-0.006-0.005-0.018-0.009-0.002-0.028   c0.016-0.019-0.009-0.027-0.04-0.03c-0.032-0.004-0.031-0.014-0.02-0.039l0.063-0.005c0.017,0.01,0.022,0.007,0.028,0.003   l0.015-0.003c0.02,0.003,0.038,0.005,0.053,0.015c0.015,0.01,0.012,0.011,0.035-0.004l0.026-0.002l0.018,0.002l0.025-0.009   c0.019-0.012,0.03-0.01,0.043-0.009c0.013,0.001,0.026,0.002,0.048-0.006c0.027-0.012,0.045,0.02,0.061,0.02   c0.015,0,0.008,0.015,0.036,0.023l0.033,0.002l0.028,0.002c0.022,0.008,0.005,0.032,0.01,0.038l0.024,0   c0.018-0.002,0.04-0.004,0.056,0.003c0.024,0.012-0.013,0.027-0.024,0.023c-0.011-0.004-0.041-0.004-0.064,0.013l0.02,0.004   l0.026,0.005c0.029-0.004,0.082,0.007,0.105,0.027c0.024,0.021,0.053,0.043,0.084,0.06c0.025,0.015-0.006,0.064-0.031,0.061   c-0.038-0.006-0.011,0-0.029,0.014c-0.018,0.016-0.013,0.034-0.033,0.016c-0.023-0.022-0.046-0.049-0.068-0.052   c-0.022-0.004-0.038,0.015-0.063,0.018L5.17,10.355L5.143,10.36c-0.009,0.024-0.033,0.024-0.052,0.024   c-0.019,0-0.025-0.038-0.025-0.014l-0.036,0.013l-0.005,0.003C5.051,10.395,5.031,10.413,5.009,10.417z M4.211,10.112l-0.043,0.005   c-0.028-0.008-0.014,0.008-0.073,0.01c-0.061,0-0.049-0.005-0.026-0.026c0.022-0.021,0.028-0.012,0.049-0.03   c0.022-0.02,0.024-0.008,0.048-0.029c0.025-0.02,0.026-0.017,0.002-0.022C4.147,10.014,4.141,10,4.152,9.987   c0.011-0.012-0.019-0.01-0.04-0.001L4.088,9.982L4.069,9.977c-0.021,0.002-0.04,0.001-0.054-0.02   c-0.014-0.023-0.03-0.02-0.026-0.036c0.006-0.016-0.009-0.032-0.007-0.06c0.003-0.028-0.023-0.017-0.018-0.026L3.946,9.832   l-0.028,0L3.892,9.829c-0.022,0-0.052-0.027-0.093-0.041C3.755,9.772,3.775,9.771,3.74,9.758c-0.034-0.012,0.002-0.05-0.02-0.033   L3.688,9.729L3.676,9.725C3.663,9.734,3.634,9.732,3.608,9.73c-0.02-0.001-0.039-0.003-0.048,0   C3.539,9.738,3.499,9.716,3.487,9.705l-0.03-0.014c0.005-0.008,0.036-0.01,0.056-0.008c0.021,0.001,0.027-0.009,0.051-0.01   c0.024,0,0.006-0.012-0.012-0.022C3.533,9.638,3.409,9.635,3.376,9.64C3.344,9.643,3.367,9.657,3.346,9.666   C3.323,9.676,3.328,9.687,3.3,9.697C3.282,9.705,3.272,9.705,3.26,9.704L3.235,9.706C3.207,9.711,3.187,9.718,3.201,9.731   l-0.02,0.024L3.141,9.772c-0.017,0.01-0.038,0.011-0.019-0.011c0.018-0.023-0.026,0.004-0.044,0.017   C3.061,9.792,3.047,9.785,3.042,9.764c0.019,0,0.039-0.006,0.06-0.023l0.019-0.008l0.023-0.011c0.011-0.01-0.019-0.01-0.025-0.036   C3.113,9.66,3.126,9.655,3.154,9.633l0.024-0.011l0.007-0.009c0.008-0.022,0.09-0.035,0.114-0.039   C3.321,9.57,3.277,9.568,3.367,9.548c0.047-0.011,0.067-0.007,0.078-0.004l0.018-0.002c0.015-0.019,0.048-0.003,0.13,0.001   c0.08,0.005,0.054,0.025,0.074,0.02l0.015,0.003C3.686,9.568,3.69,9.57,3.707,9.568c0.035-0.004,0.045,0.008,0.07,0.018   c0.026,0.008,0.034,0.008,0.04,0.025c0.006,0.017,0.022,0.031,0.06,0.035c0.039,0.003,0.03,0.021,0.062,0.036   c0.032,0.018,0,0.019,0.07,0.051C4.038,9.748,4.051,9.74,4.059,9.75l0.008-0.004L4.082,9.74C4.101,9.75,4.097,9.758,4.12,9.774   c0.023,0.016-0.034,0.003-0.004,0.016c0.016,0.009,0.015,0.004,0.016,0l0.013-0.005c0.023,0.001,0.086,0.062,0.109,0.062   C4.278,9.845,4.29,9.86,4.322,9.876C4.339,9.883,4.34,9.88,4.342,9.877h0.017L4.395,9.88l0.029,0.004   c0.017,0.013-0.033,0.021-0.012,0.038c0.021,0.016-0.003,0.023-0.029,0.032C4.356,9.964,4.408,9.954,4.409,9.964l0.016,0.003   l0.02,0.004L4.462,9.97l0.022,0.001l0.047,0.017l0.009,0.003c0.003-0.001,0.008-0.001,0.02,0.014   c0.021,0.026,0.039,0.008,0.052,0.025c0.013,0.02,0.013,0.016-0.008,0.026c-0.022,0.009-0.039,0.016-0.074,0.013   c-0.033-0.002-0.034,0.017-0.067,0.024l-0.024,0.003l-0.013,0.004c-0.015,0.012-0.041-0.001-0.085-0.008   c-0.024-0.002-0.026,0.002-0.034,0.006c-0.007,0.004-0.019,0.008-0.055,0.006C4.237,10.105,4.223,10.109,4.211,10.112z    M4.228,10.445c0.006,0.007-0.02,0.011-0.042,0.018c-0.022,0.008-0.052,0.014-0.071,0.002c-0.019-0.011-0.029-0.018-0.024,0   c0.005,0.018-0.017,0.029-0.027,0.013L4.05,10.484l-0.009,0.011c-0.019-0.017-0.025-0.031-0.048-0.034   c-0.031-0.002-0.027-0.023-0.042-0.042c-0.016-0.019-0.01-0.027-0.04-0.03c-0.031-0.004-0.059-0.018-0.029-0.031   c0.039-0.016,0.06-0.015,0.072-0.014l0.013-0.001c0.008-0.005,0.025-0.005,0.058,0.002c0.036,0.009,0.069,0.01,0.084,0.019   c0.017,0.008,0.039,0.044,0.069,0.046C4.208,10.412,4.215,10.428,4.228,10.445z M3.303,9.811L3.299,9.798l0.028-0.02l0.031,0.007   L3.363,9.79v0.012l0.013,0.009L3.372,9.826L3.37,9.842C3.351,9.845,3.336,9.857,3.32,9.854C3.305,9.85,3.296,9.841,3.29,9.831   l-0.001,0L3.286,9.829C3.285,9.826,3.28,9.827,3.279,9.823l0.001-0.002l0.006,0.007C3.287,9.83,3.289,9.83,3.29,9.831l0.016,0.002   l0.003-0.008L3.303,9.811z M11.544,3.108c0,0,0,0-0.017-0.031c-0.016-0.032-0.132-0.026-0.108,0.02   c0.018,0.033-0.031,0.031-0.083,0.028c-0.02-0.001-0.042-0.002-0.06-0.001c-0.063,0.005-0.122,0.04-0.076,0.066   c0.045,0.027-0.044,0.029-0.117,0.012c-0.072-0.016-0.067,0.032-0.009,0.07c0.056,0.037-0.113,0.032-0.077,0.057   c0.038,0.027-0.105,0.051-0.079,0.065c0.028,0.013-0.122,0.023-0.098,0.045c0.025,0.023-0.142,0.025-0.071,0.082   c0.069,0.056-0.089,0.062-0.041,0.091c0.051,0.028-0.125,0.041-0.069,0.064c0.056,0.022-0.107,0.005-0.083,0.085   c0.016,0.055-0.008,0.05-0.052,0.046c-0.022-0.002-0.047-0.004-0.075,0.001c-0.088,0.012-0.011-0.023-0.059-0.038   c-0.047-0.015,0.019-0.038-0.06-0.047c-0.078-0.012,0.014-0.059-0.041-0.043c-0.055,0.016-0.06,0.028-0.105,0.043   c-0.047,0.016-0.004-0.011-0.084-0.023c-0.079-0.013-0.011-0.071-0.093-0.08c-0.082-0.008,0.016-0.074-0.056-0.087   C9.858,3.519,9.929,3.491,9.866,3.47c-0.064-0.021-0.03-0.053-0.041-0.102c-0.012-0.05,0.046-0.023,0.051-0.051   C9.881,3.288,9.902,3.279,9.949,3.27C9.914,3.239,9.876,3.282,9.814,3.31c-0.063,0.027,0.009-0.08-0.048-0.134   C9.71,3.121,9.742,3.115,9.794,3.115c0.052-0.001,0.071-0.002,0.001-0.051c-0.07-0.049,0.071-0.026,0.014-0.068   C9.752,2.955,9.927,2.963,9.878,2.938C9.829,2.912,9.903,2.91,9.972,2.882c0.035-0.015,0.055-0.002,0.073,0.011   c0.018,0.013,0.035,0.026,0.061,0.011c0.054-0.032-0.103-0.019-0.061-0.054c0.022-0.019,0.066-0.018,0.099-0.017   c0.028,0.001,0.049,0.001,0.039-0.012c-0.019-0.026,0.088-0.023,0.056-0.041c-0.033-0.018,0.033-0.041,0.007-0.062   c-0.026-0.023-0.087,0.005-0.118,0.009c-0.029,0.005-0.075-0.026-0.111-0.032c-0.038-0.008-0.073-0.021-0.011-0.042   c0.039-0.013,0.053-0.01,0.066-0.006c0.009,0.003,0.018,0.006,0.037,0.001c0.021-0.006,0.05-0.001,0.08,0.003   c0.036,0.006,0.074,0.011,0.099-0.002c0.045-0.025-0.058-0.011-0.024-0.031c0.014-0.007-0.006-0.005-0.03-0.002   c-0.032,0.004-0.07,0.009-0.037-0.016c0.06-0.044,0-0.035-0.044-0.008C10.113,2.616,10.066,2.6,10.07,2.581   c-0.014,0.009-0.037,0.02-0.069,0.023C9.932,2.609,9.933,2.6,9.925,2.57C9.918,2.539,9.908,2.543,9.964,2.531   c0.056-0.012,0.029-0.05,0.078-0.063c0.051-0.012-0.023-0.037,0.022-0.056c0.045-0.02-0.09-0.019-0.046-0.048   c0.044-0.029-0.096-0.026-0.047-0.051c0.05-0.023-0.011-0.053-0.082-0.047C9.859,2.267,9.851,2.264,9.845,2.261   c-0.008-0.004-0.011-0.008-0.05-0.002C9.761,2.263,9.729,2.254,9.693,2.245C9.656,2.236,9.616,2.227,9.565,2.232   c-0.041,0.004-0.06,0-0.074-0.003c-0.019-0.005-0.032-0.01-0.069,0c-0.037,0.01-0.055,0.009-0.07,0.008   C9.335,2.236,9.32,2.236,9.292,2.245C9.234,2.262,9.264,2.316,9.167,2.272C9.07,2.229,9.089,2.266,9.19,2.217   C9.291,2.17,9.228,2.187,9.374,2.169C9.519,2.149,9.559,2.16,9.44,2.152C9.32,2.143,9.455,2.111,9.378,2.125   c-0.077,0.016-0.186,0.019-0.231,0c-0.044-0.02-0.165,0.006-0.039-0.043C9.204,2.046,9.231,2.048,9.284,2.05   c0.016,0,0.036,0.001,0.06,0c0.034,0,0.053,0.002,0.066,0.003C9.433,2.057,9.435,2.06,9.485,2.046   c0.075-0.02-0.008-0.037,0.109-0.059C9.71,1.966,9.549,1.94,9.711,1.927C9.78,1.922,9.823,1.925,9.859,1.927   C9.906,1.929,9.939,1.933,10,1.919c0.05-0.012,0.076-0.009,0.1-0.006c0.027,0.004,0.051,0.007,0.101-0.012   c0.042-0.016,0.068-0.014,0.091-0.012c0.021,0.002,0.04,0.004,0.07-0.006c0.031-0.012,0.052-0.011,0.076-0.009   c0.026,0.001,0.055,0.002,0.105-0.011c0.044-0.013,0.073-0.005,0.099,0.004c0.028,0.009,0.053,0.019,0.091,0.002   c0.037-0.016,0.054-0.006,0.075,0.004c0.023,0.01,0.048,0.02,0.103,0.002c0.052-0.017,0.113-0.009,0.159-0.001   c0.05,0.009,0.084,0.017,0.077-0.004c-0.016-0.042,0.042-0.055,0.14-0.018c0.099,0.035,0.144-0.007,0.219-0.023   c0.035-0.008,0.061,0.002,0.086,0.011c0.025,0.011,0.05,0.021,0.086,0.011c0.035-0.009,0.051-0.001,0.067,0.007   c0.018,0.009,0.035,0.017,0.078,0.004c0.04-0.012,0.043-0.01,0.053-0.007c0.01,0.003,0.028,0.006,0.106-0.011   c0.149-0.031,0.265-0.04,0.22,0.003c-0.046,0.042-0.041,0.031,0.124-0.025c0.092-0.031,0.124-0.015,0.153,0.002   c0.022,0.012,0.043,0.025,0.09,0.015c0.056-0.012,0.079-0.004,0.107,0.005c0.025,0.008,0.054,0.016,0.112,0.008   c0.054-0.008,0.081,0.005,0.101,0.017c0.024,0.016,0.04,0.03,0.088,0.008c0.052-0.023,0.09-0.016,0.128-0.008   c0.027,0.005,0.055,0.01,0.089,0.005c0.079-0.013,0.109,0.011,0.126,0.03c0.016,0.019,0.012-0.038,0.037-0.042   c0.024-0.003,0.081-0.014,0.113,0.006c0.031,0.02,0.075,0.023,0.007,0.04c-0.068,0.019-0.078,0.056-0.078,0.056   s0.065-0.046,0.124-0.033c0.058,0.014,0.008,0.055-0.056,0.106c-0.063,0.048,0.036,0,0.088-0.043   c0.054-0.04-0.016-0.046,0.04-0.103c0.038-0.038,0.085-0.032,0.132-0.025c0.023,0.003,0.048,0.007,0.071,0.004   c0.069-0.006,0.148-0.002,0.061,0.037c-0.085,0.039,0.021,0.041-0.035,0.068c-0.057,0.025,0.039,0.015-0.028,0.068   c-0.035,0.027-0.048,0.016-0.061,0.005c-0.013-0.01-0.028-0.02-0.063,0.002c-0.074,0.045-0.087,0.08-0.037,0.05   c0.03-0.02,0.045-0.012,0.074-0.004c0.019,0.005,0.041,0.009,0.075,0.008c0.09-0.003-0.012,0.022-0.103,0.053   c-0.049,0.017-0.058,0.008-0.066-0.003c-0.007-0.008-0.012-0.018-0.044-0.008c-0.065,0.019-0.047,0.037,0.016,0.075   c0.064,0.039-0.101,0.038-0.039,0.077c0.062,0.038,0.044,0.02,0,0.053c-0.02,0.016-0.046,0.008-0.064,0   c-0.02-0.009-0.03-0.018-0.013,0.007c0.037,0.047-0.1,0.056-0.171,0.038c-0.033-0.01-0.051-0.004-0.072,0.002   c-0.022,0.006-0.046,0.012-0.094-0.003C13.044,2.366,13.068,2.389,12.99,2.4c-0.079,0.012-0.075,0.047-0.008,0.039   c0.031-0.004,0.037,0.009,0.039,0.022c0.003,0.014,0.002,0.028,0.023,0.02c0.042-0.015,0.034,0.018,0.071,0.02   c0.035,0.002,0.029,0.018,0.072-0.015c0.023-0.018,0.036-0.005,0.046,0.008l0.026,0.012c0.021-0.022,0.055,0.009,0.051,0.07   c-0.003,0.061-0.055,0.016-0.066,0.06c-0.013,0.044-0.141-0.005-0.175-0.046c-0.033-0.043-0.108-0.023-0.166-0.04   c-0.059-0.019-0.084-0.042-0.174-0.031c-0.093,0.011,0.06,0.005,0.121,0.04c0.063,0.035-0.027,0.018-0.091,0.047   c-0.065,0.029-0.136,0.067-0.027,0.06c0.053-0.004,0.044,0.006,0.026,0.017c-0.017,0.01-0.043,0.021-0.022,0.017   c0.044-0.007,0.1-0.026,0.129-0.05c0.029-0.022,0.125,0.032,0.211,0.032c0.025,0,0.041,0,0.049-0.002   c0.021-0.001,0.008-0.003,0.026,0.008c0.026,0.015-0.128,0.028-0.097,0.049c0.031,0.022-0.143,0.014-0.114,0.039   c0.013,0.013-0.026,0.013-0.067,0.013c-0.041-0.001-0.084-0.001-0.07,0.014c0.028,0.029-0.149,0.015-0.136,0.044   c0.007,0.014-0.013,0.013-0.047,0.011c-0.032-0.002-0.077-0.003-0.117,0.01c-0.039,0.014-0.056,0.013-0.07,0.01   c-0.016-0.002-0.027-0.004-0.06,0.016c-0.023,0.013-0.044,0.008-0.068,0.003c-0.023-0.004-0.05-0.01-0.084,0.003   c-0.069,0.025-0.06-0.042-0.108-0.059c-0.023-0.007-0.016,0.01-0.013,0.026c0.003,0.018,0.002,0.036-0.042,0.025   C12.016,2.882,12,2.911,11.988,2.939c-0.013,0.03-0.022,0.059-0.055,0.046c-0.035-0.013-0.056,0.006-0.077,0.025   c-0.019,0.018-0.038,0.036-0.066,0.028c-0.057-0.014-0.158,0.001-0.125,0.042C11.699,3.122,11.544,3.108,11.544,3.108z    M9.845,2.729C9.85,2.72,9.86,2.712,9.882,2.714c0.035,0.003,0.04,0.003,0.061,0.008C9.964,2.728,9.973,2.729,10,2.725   c0.027-0.005,0.05,0.006,0.069,0.021c0.021,0.015,0.03,0.048-0.015,0.053c-0.044,0.005-0.051,0.003-0.089-0.001   c-0.037-0.003-0.041-0.006-0.06-0.023L9.872,2.763H9.859C9.842,2.759,9.84,2.738,9.845,2.729z M21.781,16.843   c-0.019,0.015-0.036,0.004-0.052-0.007c-0.016-0.011-0.03-0.021-0.042-0.005c-0.055,0.081,0.039,0.151,0.003,0.195   c-0.133,0.164-0.066,0.242-0.183,0.441c-0.123,0.21-0.156,0.321-0.181,0.424c-0.025,0.102-0.042,0.197-0.13,0.372   c-0.111,0.219-0.234,0.236-0.268,0.266c-0.119,0.103-0.38,0.023-0.353-0.164c0.025-0.188-0.103-0.173-0.028-0.375   c0.074-0.202,0.129-0.114,0.163-0.235c0.035-0.121,0.076-0.085,0.058-0.202c-0.018-0.117,0.022-0.108,0.011-0.262   c-0.011-0.154,0.06-0.136,0.084-0.253c0.014-0.069,0.035-0.067,0.057-0.066c0.016,0.002,0.033,0.002,0.046-0.027   c0.027-0.057,0.084-0.049,0.134-0.042c0.044,0.007,0.081,0.014,0.088-0.024c0.012-0.08,0.05-0.077,0.084-0.12   c0.014-0.018,0.012-0.008,0.014,0.003c0.001,0.015,0.005,0.031,0.057-0.031c0.089-0.108,0.017-0.109,0.069-0.113   c0.052-0.006-0.035-0.073,0.014-0.108c0.023-0.016,0.034-0.005,0.042,0.006c0.01,0.014,0.014,0.027,0.027-0.011   c0.024-0.07,0.099-0.113,0.092-0.146c-0.009-0.032-0.027-0.037,0.027-0.08c0.088-0.073,0.086-0.04,0.081-0.007   c-0.004,0.023-0.009,0.048,0.018,0.032C21.732,16.289,21.818,16.818,21.781,16.843z M23.229,10.144   c-0.03,0.012-0.068,0.292-0.115,0.231c-0.027-0.033-0.099,0.107-0.056,0.223c0.033,0.095,0.075,0.109-0.02,0.087   c-0.095-0.023-0.147,0.074-0.131,0.125c0.032,0.1-0.14,0.067-0.164,0.1c-0.025,0.031,0.043,0.027-0.03,0.095   c-0.072,0.067-0.142,0.027-0.194,0.069c-0.052,0.041-0.045,0.022-0.101,0.046c-0.056,0.023-0.206,0.083-0.118,0.149   c0.046,0.035-0.122,0.043-0.155,0.085c-0.03,0.041-0.278,0.073-0.328,0.154c-0.064,0.108-0.213,0.046-0.257,0.118   c-0.055,0.091-0.199,0.026-0.267,0.097c-0.034,0.037-0.054,0.033-0.067,0.03c-0.013-0.003-0.022-0.006-0.032,0.025   c-0.015,0.049-0.215,0.032-0.225,0.001c-0.017-0.045-0.063-0.08-0.038-0.128c0.024-0.048-0.051-0.108-0.049-0.214   c0.001-0.034-0.03,0.021-0.07-0.263c-0.04-0.032,0.032-0.025-0.016-0.059c-0.056-0.041,0.008-0.01-0.062-0.127   c-0.071-0.115-0.065-0.126-0.171-0.228c-0.105-0.103-0.023-0.16-0.268-0.342c-0.134-0.098-0.072-0.101-0.109-0.145   c-0.059-0.073,0.059,0.011,0.003-0.1c-0.053-0.111-0.135-0.249-0.139-0.34c-0.002-0.03-0.036-0.03-0.063-0.079   c-0.037-0.067-0.117-0.04-0.148-0.091c-0.1-0.168,0.021-0.026-0.081-0.198c-0.139-0.233-0.21-0.274-0.186-0.301   c0.024-0.026-0.078-0.049-0.103-0.15c-0.018-0.081-0.088-0.021-0.065-0.085c0.026-0.075-0.028-0.072-0.002-0.123   c0.025-0.05-0.007-0.054-0.021-0.078c-0.028,0.074,0.009,0.091-0.016,0.174c-0.026,0.083,0.041,0.069-0.005,0.143   c-0.047,0.075-0.041,0.04-0.105-0.021c-0.066-0.061-0.069-0.12-0.129-0.181c-0.059-0.06-0.045-0.094-0.095-0.137   c-0.048-0.042-0.061-0.107-0.091-0.163c0.053,0.112-0.005,0.112,0.049,0.176c0.081,0.099-0.001,0.088,0.056,0.154   c0.045,0.054,0.048,0.078,0.116,0.159c0.07,0.082-0.037,0.002,0.059,0.098c0.098,0.097-0.034-0.002,0.028,0.115   c0.118,0.219,0.181,0.212,0.208,0.313c0.025,0.1,0.077,0.112,0.155,0.189c0.079,0.077-0.101-0.021-0.007,0.106   c0.095,0.124,0,0.028,0.069,0.112c0.104,0.13,0.148,0.08,0.136,0.151c-0.01,0.069,0.126,0.186,0.081,0.213   c-0.02,0.012-0.002,0.199,0.009,0.231c0.019,0.053,0.029,0.134,0.069,0.116c0.019-0.008,0.034,0.009,0.045,0.024   c0.013,0.018,0.022,0.036,0.029,0.02c0.012-0.03,0.035,0.009,0.066,0.065c0.1,0.184,0.132,0.17,0.176,0.359   c0.044,0.188,0.072,0.185,0.087,0.161c0.029-0.045,0.018,0.062,0.093,0.076c0.074,0.013,0.052,0.048,0.1,0.051   c0.072,0.004,0.112,0.14,0.192,0.202c0.081,0.062,0.053,0.106,0.084,0.105c0.03-0.003,0.017,0.003,0.027,0.018   c0.052,0.082,0.136,0.106,0.114,0.188c-0.021,0.082-0.077,0.054-0.105,0.072c-0.028,0.018-0.095,0.035-0.028,0.029   c0.068-0.008,0.054-0.035,0.088,0.005h-0.002c0.035,0.039,0.184,0.208,0.281,0.172c0.097-0.037,0.084-0.069,0.197-0.056   c0.078,0.009,0.105-0.009,0.132-0.025c0.024-0.015,0.047-0.03,0.105-0.027c0.057,0.003,0.073-0.004,0.083-0.011   c0.011-0.007,0.016-0.016,0.066-0.009c0.066,0.007,0.209-0.105,0.23-0.111c0.048-0.012,0.12-0.027,0.105,0.04   c-0.027,0.12,0.069,0.163,0.022,0.151c-0.04-0.01,0.018,0.054-0.019,0.141c-0.008,0.018-0.004,0.016,0.002,0.015   c0.009-0.003,0.021-0.006-0.013,0.086c-0.066,0.172-0.073,0.096-0.069,0.146c0.008,0.103-0.151,0.26-0.153,0.41   c-0.005,0.207-0.18,0.251-0.2,0.347c-0.027,0.121-0.148,0.219-0.282,0.384c-0.135,0.163-0.219,0.143-0.305,0.29   c-0.085,0.148-0.199,0.165-0.26,0.294c-0.06,0.128-0.066,0.128-0.095,0.159c-0.134,0.137-0.232,0.103-0.226,0.242   c0.003,0.094-0.016,0.033-0.028,0.156c-0.009,0.079-0.052,0.071-0.063,0.146c-0.009,0.075-0.014,0.037-0.039,0.068   c-0.07,0.081,0.001,0.086-0.103,0.231c-0.121,0.169,0.151,0.16,0.068,0.288c-0.046,0.071,0.024,0.029-0.04,0.126   c-0.064,0.098,0.051,0.103,0.045,0.281c-0.001,0.07,0.029,0.076,0.07,0.137c0.039,0.062-0.002,0.132,0.01,0.188   c0.013,0.056-0.058,0.079-0.032,0.185c0.027,0.105-0.055,0.136-0.007,0.298c0.048,0.16,0.04,0.127-0.04,0.279   c-0.06,0.117-0.041,0.012-0.109,0.121c-0.045,0.073-0.175,0.203-0.256,0.193c-0.035-0.006,0,0.055-0.118,0.075   c-0.141,0.022-0.283,0.265-0.38,0.312c-0.127,0.06-0.198,0.238-0.124,0.267c0.039,0.015,0.008,0.068,0.046,0.183   c0.009,0.031-0.01,0.082,0.009,0.169c0.02,0.089-0.068,0.096-0.066,0.192c0.001,0.03-0.047,0.18-0.269,0.266   c-0.264,0.101-0.127,0.117-0.156,0.218c-0.09,0.306-0.084,0.345-0.185,0.356c-0.118,0.014-0.242,0.434-0.387,0.476   c-0.076,0.022-0.135,0.19-0.203,0.231c-0.066,0.044-0.098,0.212-0.322,0.238c-0.097,0.01-0.062,0.1-0.161,0.076   c-0.03-0.009-0.037,0.005-0.044,0.019c-0.008,0.017-0.017,0.035-0.071,0.011c-0.031-0.013-0.102-0.029-0.142-0.013   c-0.012,0.004-0.028-0.001-0.047-0.006c-0.028-0.008-0.062-0.016-0.081,0.013c-0.032,0.051-0.057,0.025-0.1,0.048   c-0.018,0.009-0.028,0.007-0.04,0.003c-0.017-0.004-0.039-0.008-0.09,0.022c-0.079,0.049-0.133,0.014-0.173-0.02   c-0.031-0.027-0.056-0.055-0.077-0.042c-0.028,0.015,0.006,0.068,0.006,0.068c-0.129-0.046-0.013-0.097-0.086-0.156   c-0.054-0.044,0.031-0.067-0.045-0.13c0.04-0.036,0.073-0.018,0.051-0.099c-0.019-0.081,0.066-0.127-0.041-0.202   c-0.15-0.106-0.096-0.43-0.137-0.456c-0.02-0.012-0.04-0.033-0.059-0.059c-0.056-0.08-0.098-0.203-0.081-0.235   c0.023-0.045-0.111-0.44-0.078-0.556c0.034-0.114-0.031-0.053,0.015-0.163c0.021-0.054-0.248-0.399-0.235-0.573   c0.008-0.111-0.145-0.235-0.129-0.444c0.023-0.304-0.041-0.211,0.024-0.256c0.065-0.044-0.007-0.329,0.082-0.532   c0.078-0.181,0.067-0.041,0.126-0.174c0.048-0.109,0.059,0.016,0.112-0.174c0.053-0.189-0.095-0.273-0.065-0.382   c0.019-0.068-0.043,0.004,0.003-0.142c0.033-0.104-0.045-0.213-0.059-0.306c-0.015-0.097-0.107-0.133-0.059-0.15   c0.049-0.017,0.11-0.029,0.125-0.06c-0.022,0.01-0.033,0.009-0.044,0.007c-0.012-0.002-0.02-0.004-0.042,0.015   c-0.04,0.036-0.067-0.011-0.069-0.023c-0.003-0.011-0.046-0.049-0.019-0.046c0.027,0.002-0.021-0.058-0.002-0.072   c0.017-0.013-0.101-0.095-0.014-0.079c0.028,0.005,0.035-0.003,0.032-0.011l-0.031-0.01c-0.025,0.013-0.037-0.005-0.054-0.039   c-0.072-0.149-0.127-0.128-0.104-0.146c0.023-0.02-0.066-0.017-0.022-0.051c0.018-0.014-0.087-0.067-0.088-0.105   c-0.002-0.022-0.128-0.141-0.128-0.141s0.046,0.011,0.004-0.015c-0.015-0.011-0.061-0.085-0.036-0.085   c0.006,0,0.028-0.048-0.006-0.039c-0.003,0.001-0.027-0.042-0.046-0.087c-0.021-0.046-0.038-0.093-0.022-0.085   c0.074,0.038,0.045-0.008,0.076-0.05c0.032-0.041,0.009-0.11,0.026-0.118c0.018-0.009,0.003,0.025,0.083,0.049   c0.008,0.002,0.024-0.028-0.006-0.033c-0.032-0.006-0.107-0.066-0.064-0.062c0.101,0.008-0.003-0.047,0.097-0.093   c-0.03-0.009-0.053-0.008-0.071-0.006c-0.026,0.001-0.041,0.002-0.046-0.021c-0.009-0.04,0.072-0.068,0.053-0.112   c-0.011-0.027,0.034-0.072,0.034-0.072c-0.002-0.082-0.019-0.11,0.004-0.158c0.032-0.063-0.035-0.073-0.021-0.102   c0.016-0.026-0.082-0.046-0.009-0.046c0.074,0-0.031-0.011,0.016-0.039c0.024-0.014,0.014-0.011-0.002-0.007l-0.032-0.002   l-0.003,0.006c-0.004,0.009-0.016,0.018-0.047-0.003c-0.053-0.039-0.055-0.116-0.067-0.073c-0.003,0.01,0,0.013-0.02-0.007v-0.002   c-0.019-0.016-0.052-0.018-0.061-0.036c0.024,0.038-0.018,0.058-0.064,0.031c0.012,0.025-0.03,0.042-0.059-0.013   c-0.046,0.021-0.006,0.034-0.036,0.048l-0.022,0.002c-0.005-0.002-0.008-0.005-0.027,0.008c-0.017,0.013-0.02,0.008-0.022,0.003   c-0.003-0.005-0.007-0.011-0.024-0.001c-0.01,0.005-0.058-0.023-0.122-0.064c-0.043-0.027,0.002-0.019-0.037-0.045   c-0.04-0.023-0.013-0.018,0.009-0.035c0.021-0.017-0.005-0.033,0.034-0.04c-0.039-0.024-0.027,0.013-0.052,0.026   c-0.025,0.013,0.003-0.033-0.018-0.041c-0.022-0.009,0.029-0.036,0.029-0.036s-0.054,0.022-0.036-0.014   c0.018-0.035-0.079-0.106-0.153-0.092c-0.03,0.005-0.13-0.012-0.065-0.03c-0.051-0.002-0.054,0.003-0.057,0.009   c-0.004,0.006-0.006,0.013-0.064,0.009c-0.019-0.001-0.032,0-0.04,0l-0.007-0.005c0.004-0.008-0.057-0.004-0.033,0.008   c0.02,0.011-0.014,0.019-0.05,0.018c-0.035,0.038-0.087,0.029-0.126,0.032c-0.053,0.089-0.061,0.074-0.076,0.06   c-0.007-0.008-0.016-0.014-0.032-0.01c0.034,0.021,0.02,0.021-0.028,0.052c-0.049,0.03-0.065,0.045-0.164,0.053   c-0.097,0.008-0.061,0.03-0.116,0.03c-0.055,0-0.006-0.037-0.116-0.037c-0.04,0-0.1-0.025-0.1-0.025   c-0.052,0.002-0.068-0.005-0.076-0.012c-0.01-0.009-0.006-0.018-0.045-0.008l-0.03-0.002c-0.02-0.002-0.04-0.005-0.034,0.002   c0.011,0.014,0.03,0.012,0.048,0.01c0.018-0.002,0.037-0.003,0.047,0.014c0,0.002-0.012,0.002-0.031,0.001   c-0.033,0-0.084-0.001-0.129,0.005c-0.175,0.024-0.225,0.093-0.265-0.006c-0.003,0.087-0.064,0.107-0.18,0.146   c-0.071,0.021-0.078-0.012-0.064-0.033c-0.107,0.021-0.036-0.037-0.172-0.076c-0.07-0.019,0.002-0.019-0.053-0.036   c-0.055-0.017-0.012-0.062-0.118-0.11c-0.108-0.05-0.095-0.083-0.082-0.101c-0.057-0.002-0.044-0.039-0.108-0.072   c-0.065-0.034,0.06-0.002-0.048-0.062c-0.021,0.006-0.067-0.015-0.101-0.036c-0.034-0.02-0.057-0.041-0.036-0.037   c0.077,0.013,0.006-0.01,0.03-0.022l0.003-0.004c-0.008,0.001-0.025,0.002-0.023-0.019h-0.006   c-0.007,0.008-0.021,0.017-0.047-0.005c-0.052-0.041-0.051-0.041-0.021-0.047c0.011-0.003-0.015-0.04-0.031-0.047   c-0.015-0.005-0.058-0.064-0.025-0.051c0.018,0.008,0.015,0,0.012-0.009l0.007-0.011c0.023,0.002-0.047-0.023-0.02-0.037   c0.027-0.014-0.028-0.021-0.009-0.038c-0.043-0.012,0.009-0.024,0.015-0.052c-0.042,0.005-0.144-0.096-0.091-0.109   c-0.055-0.002-0.096-0.05-0.07-0.091c0.012-0.019-0.059-0.046-0.049-0.074c-0.034,0.01-0.09-0.062-0.067-0.1   c-0.066-0.018-0.014-0.03-0.044-0.04c0,0,0-0.047,0.03-0.034c0.032,0.014-0.033-0.02,0.02-0.044   c-0.068-0.003-0.043,0.035-0.071,0.044c-0.027,0.009-0.013-0.024-0.036-0.036c0.075-0.041,0.125-0.019,0.11-0.035   c-0.013-0.015-0.041-0.005-0.067,0.004c-0.023,0.008-0.045,0.016-0.056,0.008c-0.011-0.008,0.035-0.013,0.013-0.027l-0.015,0.008   c-0.005,0.009-0.013,0.017-0.041,0c-0.049-0.031-0.024-0.022,0.019-0.043c-0.052,0.005-0.052,0.008-0.067-0.008   c-0.017-0.016-0.035-0.054,0.012-0.054c0.047,0-0.015-0.022,0.058-0.019c0.02,0.001,0.025-0.002,0.028-0.005   c0.004-0.004,0.006-0.009,0.042-0.004l0.024-0.005c0.007-0.006,0.009-0.013,0.042,0.011l0.03-0.006l0.005-0.007   c-0.02,0.003-0.03-0.002-0.041-0.007c-0.012-0.005-0.023-0.012-0.047-0.004c-0.02,0.006-0.025,0.003-0.03,0.001   c-0.006-0.004-0.01-0.007-0.045,0.007h-0.022c-0.01-0.003-0.02-0.007-0.051,0.022c-0.028,0.025-0.009-0.05-0.008-0.073   c0.004-0.035,0.004-0.031,0.015-0.027c0.008,0.003,0.02,0.005,0.042-0.004c0.056-0.022-0.039-0.031,0.115-0.06   c-0.17,0.01-0.079,0.041-0.128,0.051c-0.048,0.011-0.014-0.004-0.052-0.061c-0.041-0.055,0.021-0.019-0.012-0.058   c-0.033-0.038,0.006-0.033,0.043-0.037c-0.032-0.018-0.046-0.011-0.055-0.003c-0.011,0.009-0.018,0.016-0.037-0.002   c-0.039-0.035,0.043-0.013-0.025-0.041c-0.066-0.028,0.016-0.023-0.046-0.04c-0.061-0.016-0.012-0.018,0.019-0.053   c0.031-0.036,0.033-0.019,0.098-0.125c0.065-0.104,0.048-0.106,0.088-0.18c-0.04-0.114,0.052-0.109,0.042-0.23   c-0.005-0.068,0.042-0.161-0.058-0.297c-0.007-0.011,0.058-0.062,0.025-0.052c-0.043,0.013-0.033,0.004-0.015-0.048   c0.017-0.051,0.024-0.051,0.024-0.085c0-0.011-0.018-0.109-0.052-0.098c-0.033,0.01-0.038-0.033-0.018-0.102   c0.008-0.03-0.005-0.02-0.018-0.01c-0.017,0.013-0.035,0.025-0.007-0.048c0.054-0.134,0.101-0.118,0.133-0.306   c0.035-0.19,0.17-0.232,0.236-0.429c0.091-0.278,0.118-0.048,0.177-0.258c0.025-0.095,0.032-0.068,0.074-0.147   c0.074-0.142,0.242-0.034,0.291-0.14c0.04-0.086,0.221-0.143,0.255-0.268c0.019-0.073-0.111-0.055-0.065-0.174   c0.084-0.213,0.111-0.108,0.158-0.291c0.031-0.131,0.187-0.008,0.335-0.312c0.062-0.128,0.094-0.104,0.13-0.17   c0.036-0.066,0.084-0.032,0.072-0.012c-0.002,0.005,0.033,0.041,0.068,0.039c0.02-0.002,0.04,0.009,0.062,0.02   c0.024,0.011,0.05,0.023,0.081,0.019l0.029,0.008c0.014,0.01,0.022,0.02,0.071-0.036c0.022-0.024,0.005-0.002,0.004,0.018   c-0.002,0.016,0.007,0.032,0.046,0.029l0.04,0.01c0.036,0.005,0.036,0,0.038-0.006c0-0.005,0.002-0.01,0.04-0.006   c0.025,0.003,0.025-0.014,0.031-0.032c0.005-0.017,0.014-0.034,0.051-0.032c0.03,0.002,0.04-0.01,0.043-0.023   c0.006-0.018-0.001-0.036,0.033-0.007c0.081,0.069,0.075-0.034,0.117-0.037c0.048-0.004,0.099-0.09,0.159-0.095   c0.062-0.005,0.007-0.028,0.153-0.034c0.056-0.002,0.082,0.002,0.097,0.006c0.023,0.008,0.016,0.014,0.05-0.008   c0.028-0.018,0.031-0.018,0.036-0.017c0.006,0,0.013,0,0.044-0.014c0.024-0.011,0.045-0.006,0.07-0.001   c0.022,0.004,0.048,0.008,0.083,0.001c0.032-0.007,0.039,0.004,0.042,0.015c0.004,0.014,0.002,0.028,0.034,0.005   c0.056-0.04,0.075-0.006,0.095-0.036c0.024-0.034,0.031-0.021,0.041-0.008c0.007,0.009,0.015,0.018,0.031,0.013   c0.044-0.016-0.034-0.054,0.056-0.011c0.021,0.011,0.019,0.008,0.021,0.005c0.002-0.002,0.011-0.005,0.067,0.014   c0.098-0.048,0.077-0.015,0.149-0.056c0.072-0.039,0.054,0.016,0.09,0.018c0.038,0.005-0.062,0.033-0.007,0.05   c0.032,0.01-0.048,0.048,0.045,0.021c0.051-0.016,0.079-0.05,0.08-0.008c0,0.042-0.014-0.003-0.011,0.049   c0.004,0.051-0.042-0.004-0.026,0.081c0.017,0.085,0.083,0.075,0.072,0.119c-0.011,0.043,0.055,0.039-0.01,0.133   c-0.065,0.095-0.106,0.024-0.137,0.091c-0.033,0.068,0.075,0.109,0.101,0.084c0.026-0.023-0.028-0.044,0.03-0.01   c0.059,0.032-0.068,0.011,0.003,0.041c0.028,0.011,0.012,0.028,0.064,0.052c0.055,0.024,0.071,0.027,0.129,0.055   c0.045,0.021,0.075,0.011,0.102,0.002c0.031-0.01,0.059-0.021,0.095,0.011c0.035,0.029,0.06,0.025,0.086,0.02   c0.027-0.004,0.053-0.01,0.089,0.026c0.03,0.03,0.05,0.029,0.067,0.028c0.021-0.001,0.035-0.002,0.046,0.064   c0.02,0.116,0.07,0.112,0.115,0.107c0.02-0.002,0.041-0.004,0.057,0.005c0.056,0.028,0.117-0.004,0.253,0.082   c0.136,0.086,0.077,0.094,0.175,0.085c0.098-0.009,0.149-0.189,0.081-0.201c-0.029-0.004-0.046-0.079,0.031-0.124   c0.064-0.038,0.071-0.085,0.193-0.073c0.123,0.014-0.017,0.015,0.069,0.027l0.016-0.005c0.001-0.007,0.006-0.015,0.118,0.02   c0.149,0.046-0.023,0.073,0.105,0.067c0.049-0.003,0.057,0.008,0.058,0.019c0.002,0.014-0.005,0.027,0.055,0.015   c0.046-0.009,0.026,0.021,0.057,0.034c0.021,0.008,0.064,0.067,0.121,0.033c0.025-0.015,0.165-0.008,0.223,0.028   c0.049,0.03,0.095,0.057,0.117,0.043c0.061-0.038-0.014,0.014,0.073,0.021c0.045,0.004,0.032,0.079,0.086,0.033   c0.054-0.046,0.118-0.038,0.101-0.06c-0.015-0.022,0.13-0.04,0.127-0.041c0.029,0.013,0.04,0.01,0.052,0.006   c0.012-0.004,0.025-0.008,0.059,0.006c0.078,0.035,0.118,0.05,0.187,0.043c0.021-0.002,0.042,0.004,0.064,0.01   c0.052,0.014,0.106,0.028,0.172-0.062c0.01-0.094,0.035-0.064,0.037-0.134c0-0.07,0.025-0.057,0.025-0.118   c0-0.062,0.039-0.074,0.04-0.125c0.002-0.051,0.054-0.032,0.055-0.097C19.307,7.75,19.443,7.78,19.35,7.732   c-0.069-0.036-0.003-0.039-0.014-0.065c-0.033-0.072,0.067-0.015,0.021-0.095c-0.014-0.025-0.03-0.012-0.044,0l-0.025,0.015   c-0.092-0.002-0.068-0.084-0.153-0.022c-0.086,0.061-0.071,0.089-0.071,0.089s-0.128,0.034-0.151,0.007   c-0.069-0.082-0.108-0.062-0.164-0.099c-0.056-0.037-0.125-0.03-0.105,0.011c0.026,0.051-0.103,0.051-0.114,0.073   c-0.014,0.033-0.131-0.049-0.096-0.074c0.036-0.027-0.074-0.031-0.074-0.031l-0.089,0.015c-0.011-0.012-0.032-0.009-0.052-0.005   h-0.033c-0.029-0.033,0.086-0.017,0.091-0.047L18.17,7.507c0,0-0.019-0.043,0.015-0.032c0.017,0.006,0.025-0.006,0.025-0.017   c0-0.012-0.008-0.023-0.024-0.018c-0.032,0.01-0.025-0.028-0.071-0.03c-0.054-0.002,0.036-0.054-0.048-0.091   c-0.034-0.014-0.038-0.044-0.079-0.015c-0.042,0.029,0.017-0.043-0.021-0.07c-0.037-0.029-0.002-0.052,0.018-0.028   c0.031,0.039,0.023,0.028,0.023,0.017l0.016-0.009c0.037,0.006-0.044-0.048-0.011-0.055c0.034-0.007-0.026-0.02-0.005-0.035   c0.019-0.016-0.103-0.034-0.01-0.063c-0.131,0.001-0.037,0.004-0.07-0.058c-0.023-0.042,0.005-0.016,0.049-0.035   c0.045-0.018,0.092-0.073,0.112-0.043c0.009,0.016,0.02,0.008,0.031,0.002l0.039-0.003c0.02,0.016,0.197,0.011,0.145-0.009   c-0.065-0.024,0.086-0.016,0.135-0.031c-0.088-0.029-0.2,0.004-0.162-0.062c0.019-0.033,0.076-0.015,0.137,0.003   c0.062,0.018,0.127,0.035,0.159,0.001c0.063-0.068,0.127-0.03,0.211-0.084c0.045-0.028,0.098-0.025,0.147-0.022   c0.042,0.003,0.08,0.006,0.106-0.014c0.032-0.023,0.045-0.003,0.067,0.017c0.016,0.015,0.037,0.03,0.074,0.027   c0.086-0.005,0.026,0.047,0.125,0.054c0.099,0.006,0.035,0.051,0.092,0.043c0.006,0,0.02,0.006,0.041,0.013   c0.036,0.011,0.096,0.023,0.172-0.005c0.031-0.012,0.06-0.001,0.093,0.009c0.061,0.019,0.131,0.038,0.238-0.087   c-0.005-0.008-0.01-0.03-0.015-0.072c-0.008-0.083-0.032-0.053-0.055-0.098c-0.03-0.055-0.044-0.014-0.134-0.079   c-0.148-0.106-0.133-0.042-0.197-0.095c-0.166-0.137-0.327-0.131-0.358-0.19c-0.015-0.026-0.007-0.026,0.008-0.026   c0.019,0,0.052,0.001,0.069-0.057c0.015-0.048,0.051-0.045,0.074-0.042c0.022,0.004,0.028,0.008-0.029-0.054   c-0.056-0.061-0.067-0.054-0.048-0.048c0.018,0.006,0.065,0.013,0.126-0.045c0.049-0.044,0.048-0.052-0.126-0.011l-0.041,0.016   c-0.017,0.015-0.026,0.013-0.035,0.01c-0.011-0.003-0.022-0.006-0.045,0.022c-0.025,0.032-0.032,0.026-0.039,0.019   c-0.008-0.006-0.016-0.013-0.044,0.016c-0.042,0.043-0.021,0.025-0.076,0.013c-0.033-0.008-0.048,0.004-0.067,0.015   c-0.016,0.01-0.036,0.02-0.071,0.017c-0.056-0.002,0.013-0.01,0.041-0.015c0.027-0.005,0.001-0.018-0.047-0.002   c-0.045,0.016-0.055,0.011-0.058,0.007l-0.008-0.004c-0.013,0.004,0.006,0.028,0.033,0.025c0.026-0.003,0.025,0.012,0.043,0.015   c0.009,0.002,0.117,0.038,0.076,0.068c0.026-0.002,0.044,0.004,0.058,0.009c0.022,0.007,0.037,0.014,0.064,0.001   c0.03-0.015,0.049-0.002,0.101,0.011c0.048,0.011-0.01,0.003-0.006,0.024l0,0.01l-0.016,0.004   c-0.009,0.009-0.031,0.002-0.054-0.004c-0.029-0.008-0.061-0.016-0.075,0.006c-0.016,0.025-0.017,0.024-0.031,0.023   c-0.009,0-0.021-0.001-0.045,0.004c-0.063,0.012,0,0.098-0.145,0.04c-0.03-0.013,0.055-0.069-0.017-0.075   c-0.051-0.004,0.007-0.077-0.103-0.043c-0.022,0.008-0.018-0.03-0.004-0.037c0.03-0.016,0.03-0.033,0.095-0.057   c-0.054-0.01-0.034-0.023-0.034-0.023s-0.032,0.031-0.043,0.011l-0.03-0.008c-0.016,0.001-0.039,0.002-0.066-0.013   c-0.038-0.023-0.04-0.021-0.041-0.018l-0.014-0.003c-0.062-0.032,0.086-0.007,0.015-0.034c-0.047-0.016-0.031-0.019-0.005-0.014   c0.028,0.006,0.087,0.008,0.087,0.008s0.009-0.006-0.072-0.021c-0.081-0.015-0.051,0.007-0.101,0.009   c-0.05,0.002-0.031,0.025-0.102,0.048c-0.036,0.013-0.011-0.001-0.026-0.022c-0.015-0.02-0.046-0.019-0.017,0.012   c0.03,0.03,0.005,0.017,0,0.033c-0.004,0.016-0.027,0.014-0.049,0.048c-0.02,0.035,0.039,0.005-0.016,0.042   c0.005,0.019-0.014,0.018-0.014,0.018l0.005,0.04l-0.028,0.013l-0.02,0.018c0.004-0.011,0.01-0.04-0.015-0.027   c-0.025,0.014,0.011,0.01-0.001,0.028c-0.012,0.019,0.008,0.013-0.01,0.031c-0.018,0.019-0.01,0.027-0.012,0.049   c-0.001,0.023,0.005,0.035,0,0.052c-0.007,0.038,0.01,0.022,0.012,0.044c0.004,0.023-0.019,0.038-0.024,0.033   c-0.004-0.007-0.013-0.015-0.022,0.008c-0.006,0.024-0.023,0.035-0.031,0.071c-0.005,0.026,0,0.025-0.005,0.023h-0.014   c-0.026,0.006-0.015,0.026-0.023,0.036l0.016,0.018c-0.015,0.002,0.017,0.016,0.032,0.041c0.018,0.026-0.011,0.019,0.006,0.023   c0.017,0.004-0.009-0.002,0.007,0.018c0.02,0.023,0.073,0.06,0.121,0.091c0.045,0.03,0.06,0.015,0.056,0.029   c-0.002,0.031-0.019,0.026-0.036,0.022l-0.032,0.003l-0.03-0.003l-0.034-0.009c-0.037,0.003-0.021,0.032-0.046,0.038   c-0.025,0.007,0.004,0.025-0.032,0.04c-0.034,0.015-0.06,0.032-0.087,0.05c-0.027,0.018-0.066,0.022-0.041,0   c0.025-0.022,0.037-0.044,0.066-0.049c0.027-0.002,0.029-0.033-0.008-0.016c-0.039,0.016-0.045,0.031-0.074,0.038   c-0.03,0.007-0.026-0.03-0.034-0.043c-0.006-0.014-0.056-0.009-0.038-0.021c0.009-0.006-0.007-0.001-0.027,0.005   c-0.02,0.005-0.045,0.011-0.059,0.005l-0.037-0.003l-0.015-0.006c0.009-0.016-0.035-0.02-0.042-0.003l-0.028,0.009l-0.023,0.008   c-0.005,0.027-0.041,0.006-0.046,0.024c-0.006,0.019-0.014,0.027,0.007,0.039c0.022,0.009,0.027,0.036,0.003,0.018   c-0.024-0.02-0.043-0.018-0.029-0.002c0.016,0.015,0.017,0.036,0.003,0.019c-0.013-0.018-0.032-0.019-0.026-0.009   c0.007,0.01,0.007,0.022-0.014,0.008c-0.022-0.015,0.002-0.015-0.011-0.025l-0.022-0.002l-0.026-0.009   c-0.005-0.016-0.011-0.022-0.038-0.028c0.02,0.017-0.011,0.04,0,0.051c0.011,0.01-0.004,0.025,0.02,0.043   c0.023,0.018,0.015,0,0.038,0.037c0.023,0.037,0.044,0.054,0.023,0.061c-0.021,0.004-0.021,0.002-0.013-0.007l-0.019-0.034   c-0.011-0.01-0.039,0-0.019,0.023c0.02,0.024,0.016,0.02,0,0.029c-0.017,0.01-0.003,0.008,0.015,0.01   c0.016,0.002,0.011,0.027,0.024,0.029c0.012,0.002-0.024,0.045,0.004,0.044c0.027-0.002,0.051,0.008,0.06,0.02   c0.009,0.011,0.023,0.029,0.048,0.029c0.024,0.001,0.032,0.013,0.056,0.042c0.024,0.029,0.007,0.025,0.01,0.059   c0.003,0.031-0.028-0.003-0.036-0.018c-0.009-0.013-0.016-0.007-0.041-0.006c-0.026,0.001-0.071,0-0.047,0.014   c0.024,0.014,0.003,0.03,0.016,0.036c0.013,0.006,0.031,0.019,0.01,0.024c-0.019,0.005-0.034,0.041-0.039,0.021   c-0.003-0.019-0.009-0.005-0.026-0.019c-0.017-0.013,0.001,0.024,0.017,0.033c0.016,0.008-0.006,0.023,0.008,0.044   c0.014,0.022,0.007,0.029,0.016,0.038c0.009,0.01,0.031,0.058,0.005,0.031c-0.026-0.028-0.045-0.043-0.039-0.021   c0.004,0.022-0.022,0.038-0.024,0.006c-0.004-0.031-0.022-0.055-0.028-0.029c-0.005,0.024-0.02,0.008-0.038-0.011   c-0.031-0.032-0.119-0.052-0.075-0.067c0.044-0.015-0.029-0.092-0.049-0.066c0-0.018-0.009-0.033-0.026-0.04   c-0.017-0.008-0.014-0.028,0.006-0.025l0.021-0.015l0.03-0.012l0.026-0.002c0.01-0.005,0.022-0.009,0.044,0.002   c0.022,0.01,0.028,0.009,0.035,0.008l0.026,0.007c0.034,0.017,0.062,0.034,0.049,0.023c-0.042-0.038,0.02-0.045-0.01-0.039   c-0.03,0.007-0.009,0.023-0.051-0.001c-0.041-0.025-0.054-0.028-0.069-0.019c-0.019,0.01-0.031,0-0.04-0.011l-0.03-0.007   c-0.021,0.031-0.024,0.028-0.03,0.009c-0.007-0.018-0.039-0.029-0.036-0.043c0.001-0.013,0.011-0.029,0.04-0.018   c0.027,0.01,0.023,0,0.003-0.01c-0.019-0.01,0-0.031-0.016-0.016l-0.021-0.002L17.229,7.15c0.01,0.022-0.01,0.041-0.02,0.02   c-0.01-0.019-0.034-0.024-0.043-0.051c-0.01-0.027-0.026-0.009-0.033-0.038c-0.008-0.03-0.037-0.026-0.055-0.03l0.001-0.019   c0-0.003-0.052-0.025-0.058-0.052c-0.008-0.026-0.022-0.001-0.055-0.038c-0.032-0.038-0.011-0.034-0.023-0.048   c-0.012-0.013-0.018-0.035,0.009-0.01c0.026,0.023,0.047,0.023,0.023,0.002c-0.023-0.022-0.038-0.019-0.039-0.043   c-0.001-0.023-0.018-0.033-0.001-0.046c0.017-0.013,0.028-0.026,0.009-0.027c-0.019,0-0.018-0.027-0.014-0.048   c0.003-0.021-0.042-0.052-0.025-0.052c0.017-0.002,0.033-0.019,0.014-0.022l-0.034-0.016c-0.012-0.014-0.021-0.019-0.044-0.025   c-0.024-0.006-0.03-0.028-0.059-0.041c-0.031-0.011,0.008-0.012,0.023-0.015l-0.028-0.005c-0.014,0.004-0.016,0.004-0.042-0.004   c-0.048-0.015-0.075-0.016-0.101-0.032c-0.027-0.016,0.024-0.006-0.007-0.021c-0.033-0.017-0.061-0.04-0.092-0.059l-0.016,0.002   c-0.002,0.007-0.006,0.014-0.033-0.005c-0.05-0.037-0.009-0.018-0.082-0.058c-0.074-0.04-0.11-0.064-0.073-0.073   c0.039-0.008,0.02,0.006-0.02-0.02c-0.038-0.025-0.079-0.041-0.079-0.066c0.004-0.061-0.043-0.063-0.037-0.08l-0.026,0.065   c-0.014,0.008-0.023,0.036-0.04-0.001c-0.012-0.023-0.057-0.077-0.028-0.084c0.028-0.007,0.028-0.03,0-0.025l-0.022-0.013   l-0.016-0.007c-0.015,0.027-0.009,0.03-0.05,0.035c-0.042,0.004-0.092,0.006-0.07,0.034c0.023,0.027,0.023,0.049,0.002,0.051   c-0.021,0.001-0.02,0.016-0.003,0.037c0.017,0.022-0.005,0.054,0.023,0.078c0.028,0.023,0.058,0.013,0.093,0.041   c0.036,0.028,0.047,0.055,0.071,0.087c0.024,0.031,0.031,0.081,0.077,0.127c0.041,0.039,0.045,0.043,0.08,0.07   c0.035,0.027,0.054,0.01,0.08,0.025c0.013,0.008,0.029,0.008,0.046,0.007c0.016-0.001,0.032-0.002,0.048,0.006   c0.03,0.016,0.031,0.024,0.017,0.033c-0.015,0.01-0.052,0.017,0.001,0.041c0.054,0.024,0.096,0.026,0.135,0.052   c0.038,0.026,0.045,0.05,0.065,0.057c0.019,0.009,0.053,0.015,0.082,0.039c0.029,0.022,0.043,0.049,0.027,0.05   c-0.015,0.002,0.009,0.042-0.013,0.03c-0.022-0.012-0.024-0.038-0.058-0.056l-0.029-0.002l-0.034-0.006   c-0.014-0.018-0.025-0.018-0.036,0c-0.01,0.016-0.029,0.033-0.023,0.042l-0.007,0.034c-0.003,0.009-0.005,0.018,0.018,0.025   c0.023,0.009,0.034,0.025,0.039,0.044c0.005,0.02,0.036,0.024,0.03,0.043l-0.021,0.008l-0.02,0.007   c-0.008,0.019,0.01,0.034-0.002,0.056c-0.013,0.023-0.041,0.017-0.056,0.066c-0.014,0.05-0.047,0.066-0.075,0.064   c-0.031-0.002-0.05-0.028-0.029-0.053c0.043-0.051-0.017-0.062,0.014-0.085c0.056-0.037,0.02-0.026,0.009-0.056   c-0.011-0.03-0.052-0.07-0.057-0.11c-0.005-0.041-0.003-0.048-0.029-0.037c-0.025,0.009-0.025-0.007-0.056-0.017   c-0.03-0.01-0.056-0.027-0.04-0.038c0.017-0.01-0.039-0.032-0.059-0.032L16.24,6.842l-0.019-0.019   c-0.04,0.032-0.056-0.04-0.079-0.044c-0.024-0.002-0.065,0.002-0.082-0.014c-0.018-0.016-0.065-0.06-0.084-0.07   c-0.018-0.011-0.03-0.029-0.03-0.04c0-0.01-0.036-0.016-0.052-0.035c-0.016-0.02-0.018-0.051-0.04-0.047   c-0.02,0.003-0.045,0.003-0.053-0.025c-0.006-0.029-0.055-0.085-0.082-0.095c-0.029-0.01-0.002-0.032-0.035-0.055   c-0.036-0.022-0.028-0.073-0.112-0.105c-0.095-0.037-0.15-0.035-0.181-0.002c-0.032,0.031-0.096,0.047-0.119,0.064l0.002-0.021   l-0.005,0.023c-0.025,0.008-0.03,0.006-0.053,0.011c-0.025,0.006-0.012,0.024-0.027,0.027c-0.014,0.004-0.01,0.014-0.031,0.038   c-0.02,0.025-0.035,0.031-0.055,0.017c-0.004,0.022-0.049-0.006-0.053-0.017c-0.004-0.012-0.034-0.025-0.058-0.026   c-0.026-0.003-0.007-0.024-0.036-0.022c-0.027,0.002-0.034,0.017-0.066,0.025c-0.031,0.009-0.033,0.004-0.051-0.001   c-0.017-0.004-0.04,0.03-0.078,0.055c-0.037,0.025-0.017,0.024-0.037,0.04c-0.021,0.017,0,0.017-0.013,0.037l-0.02-0.013   l0.017,0.013c0.028,0.003,0.039,0.026,0.007,0.028c-0.031,0.001,0.028,0.025,0.009,0.02c-0.009-0.002-0.009,0.015-0.007,0.032   c0.001,0.016,0.004,0.033-0.001,0.031l-0.015,0.011L14.68,6.675c-0.022,0-0.058,0.012-0.076,0.032   c-0.016,0.022-0.011,0.016-0.042,0.027C14.53,6.746,14.42,6.79,14.406,6.805c-0.014,0.014,0.007,0.017-0.006,0.04   c-0.012,0.022-0.027,0.021-0.023,0.004c0.005-0.014-0.021,0.037-0.075,0.076c-0.02,0.014-0.03,0.02-0.049,0.048   c-0.039,0.053-0.018,0.083-0.003,0.103c0.014,0.02,0.026,0.018,0.049,0.027c0.024,0.011-0.011,0.033-0.022,0.035   c-0.01,0.002-0.006,0.059-0.024,0.057c-0.017-0.002,0.014,0.036-0.011,0.036L14.23,7.263l0.009,0.018   c-0.012,0.012-0.02,0.018-0.044,0.016c-0.023-0.002-0.026,0.016-0.046,0.027c-0.019,0.012-0.043,0.023-0.064,0.048   c0.006,0.03-0.024,0.087-0.039,0.074l-0.054,0.009c-0.016,0-0.033-0.002-0.07,0.004c-0.034,0.005-0.043,0.003-0.087,0.023   c-0.045,0.022-0.053,0.023-0.064,0.017c-0.011-0.005-0.061,0.01-0.114,0.029c-0.053,0.018-0.033,0.033-0.07,0.041l-0.016,0   l-0.014-0.002c-0.024,0.005-0.032-0.014-0.045-0.017l-0.009-0.04l-0.012-0.017c-0.022-0.019,0.006-0.036-0.007-0.027   c-0.013,0.009-0.014,0.009-0.03-0.009c-0.014-0.022-0.053-0.036-0.066-0.034l-0.007-0.009l-0.011-0.007   c-0.01,0.004-0.027,0.004-0.046,0.004l-0.036,0.001c-0.028,0.003-0.04-0.011-0.044-0.016c-0.008,0.023-0.012,0.027-0.047,0.027   c-0.034,0-0.04,0.019-0.062,0.004l-0.026-0.008l-0.014-0.003l-0.03-0.001l-0.025,0.001c-0.018-0.004-0.044,0.002-0.014-0.017   c0.029-0.02,0.009-0.03,0.029-0.047c0.021-0.017,0.017-0.024,0.022-0.047l-0.003-0.006l-0.006-0.01   c0.004-0.029,0.018-0.063,0.007-0.084c-0.012-0.021-0.001-0.016,0.007-0.025c-0.026,0.012-0.067,0.027-0.06,0.006   c0.005-0.021-0.002-0.02,0.004-0.038c0.007-0.02,0-0.011-0.012-0.005C13,7.147,12.987,7.136,12.998,7.107   c0.015-0.03-0.01-0.07,0.005-0.079l0.011-0.001c0.006,0.002,0.011,0.004,0.032-0.04c0.028-0.063-0.007-0.013,0.01-0.055   c0.016-0.042,0.018-0.053,0.033-0.087c0.014-0.034,0.001-0.062,0.02-0.107c0.019-0.044-0.011-0.045,0.005-0.059   c0.012-0.014-0.013-0.025,0.004-0.038l-0.002-0.023l-0.01-0.035c0.024-0.01,0.052-0.023,0.021-0.019   c-0.029,0.004-0.015-0.019-0.018-0.041c-0.005-0.021-0.03-0.01-0.013-0.027c0.029-0.033-0.038-0.029-0.023-0.037   c0.014-0.008-0.026-0.011,0.002-0.023c0.028-0.014,0.039-0.031,0.051-0.025l0.027-0.006l0.022-0.007   c0.01,0.002,0.036-0.006,0.015-0.011c-0.021-0.006-0.008-0.011,0.004-0.02l0.042-0.012l0.019,0.005   c-0.007,0.006,0.046,0.025,0.076,0.027c0.029,0.002,0.104,0.004,0.123-0.007c0.019-0.009,0.037-0.007,0.032-0.002   c-0.005,0.006,0.006,0.002,0.029,0.006c0.023,0.005,0.094,0.005,0.145,0.011c0.024,0.003,0.045-0.001,0.063-0.006   c0.021-0.004,0.037-0.009,0.047-0.003c0.017,0.013,0.023,0.013,0.044,0.02l0.021-0.008L13.86,6.39   c0.023,0.009,0.069,0.014,0.069,0.014s0.04,0.007,0.062-0.002c0.021-0.01,0.021-0.002,0.046-0.002L14.056,6.4   c0.017-0.002,0.031-0.01,0.039-0.028c0.01-0.024,0.025-0.105,0.041-0.13c0.017-0.025,0.019-0.078,0.026-0.124   c0.009-0.043,0.04-0.001,0.056,0.032c-0.005-0.073-0.061-0.057-0.039-0.102c0.018-0.034,0.025-0.019,0.004-0.039   c-0.022-0.02,0.026-0.057,0.002-0.042c-0.028,0.015-0.017-0.004-0.055-0.026c-0.038-0.023-0.058-0.018-0.07-0.034   c-0.028-0.032-0.039-0.04-0.025-0.053l-0.002-0.026c0.013-0.002,0.027-0.013-0.003-0.013c-0.027,0-0.041-0.017-0.026-0.024   c0.017-0.007-0.024-0.026-0.036-0.023l-0.013-0.012l-0.019-0.012c-0.039,0.006-0.029,0.044-0.055-0.002   c-0.008-0.014-0.042-0.011-0.058-0.029l-0.037-0.004l-0.035,0.002c-0.032-0.012-0.011-0.03-0.032-0.036   c-0.02-0.005,0.007-0.021,0.028-0.02c0.021,0.003-0.031-0.014-0.011-0.015c0.02-0.001-0.031-0.014-0.04-0.011l-0.001-0.03   l0.032-0.007l0.023,0.001c0.027-0.001,0.055,0,0.058-0.012c0.005-0.014,0.018-0.016,0.041-0.017   c0.024-0.003,0.035-0.011,0.045,0.007c0.011,0.017,0.005,0.035,0.019,0.025l0.045-0.005l0.019,0.001l0.023,0.001   c0.007,0.011,0.035,0.014,0.061,0.012c0.025-0.002-0.011-0.01,0.002-0.031c0.012-0.021,0.004-0.023,0.008-0.041   c0.004-0.017,0-0.028-0.009-0.048c-0.009-0.019-0.005-0.034-0.013-0.044c-0.009-0.011,0.01-0.011,0.027-0.006h0.016l0.023,0.011   c0,0.021,0.023,0.028,0.023,0.042l0.028,0.029c0.011-0.012,0.015-0.018,0.034-0.012l0.032-0.011l0.035-0.013   c0.03,0.003,0.047,0.005,0.024-0.007c-0.025-0.012-0.007-0.013,0.003-0.028c0.011-0.013,0.021-0.006,0.042-0.016   c0.022-0.013,0.026-0.013,0.06-0.016c0.034-0.003,0.079-0.001,0.079-0.036c-0.001-0.035,0.015-0.016,0.013-0.034l0.016-0.032   c0.003-0.009-0.009-0.031,0.025-0.032c0.034-0.001,0.031-0.007,0.065-0.007c0.035,0.001,0.04-0.007,0.066-0.02   c0.025-0.013,0.042-0.032,0.081-0.047c0.022-0.003,0.026,0.006,0.036,0.014h0.021l0.022,0.001l0.01,0.001l0.026,0.008   c-0.023-0.02-0.004-0.034-0.018-0.031l-0.026-0.011c0.012-0.002,0.05-0.006,0.031-0.013c-0.02-0.007-0.048-0.003-0.034-0.026   c0.014-0.022,0.029-0.029,0.043-0.068c0.014-0.041,0.018-0.058,0.031-0.07c0.012-0.011,0.025-0.013,0.021,0.005l0.007,0.005   l0.012,0.01c-0.001,0.025-0.005,0.031,0.005,0.028l0.011,0.009l-0.008,0.009L14.923,5.09l-0.009,0.013l-0.001,0.003l0.028-0.004   c0.006-0.017,0.004-0.014,0.027-0.024c0.022-0.009,0.019-0.016,0.013-0.024c-0.008-0.008,0.02-0.03,0.001-0.03   c-0.019,0-0.02-0.018-0.018-0.035l0.027-0.02l0.048-0.003l0.024-0.005c0.013-0.005,0.028-0.01,0.044,0.001l-0.006,0.03l0.012-0.017   c0.013-0.007-0.005-0.009,0.015-0.021c0.031-0.019,0.039-0.019,0.047-0.018l0.021-0.006c0.03-0.014,0.04-0.014,0.053,0.003   l-0.003,0.014l0.018,0.013l0.004-0.021l0.031,0.003c0.004-0.018-0.001-0.015,0.011-0.03c0.011-0.015,0.005-0.041,0.026-0.029   l0.026,0.003l0.025,0.004c0.014,0.012,0.013,0.028,0.045,0.024c-0.018-0.006-0.033-0.033-0.054-0.035   c-0.022-0.002-0.032-0.005-0.032-0.015l0.005-0.024c-0.02-0.003-0.027-0.008-0.021-0.016c0.006-0.009-0.003-0.009-0.013-0.009   c-0.008,0-0.016,0-0.015-0.006l0.015-0.006l0.002-0.01L15.286,4.75l0.006-0.011l-0.006-0.035l-0.029-0.018   c-0.013-0.01-0.03-0.017-0.013-0.022c0.018-0.005-0.004-0.009-0.009-0.036l-0.013-0.012L15.216,4.61   c-0.002-0.021,0-0.027,0.007-0.037L15.214,4.55c-0.013-0.009-0.031-0.033-0.014-0.05c0.016-0.017,0.03-0.002,0.042,0.016   c0.011,0.017,0.04,0.014,0.029-0.003c-0.012-0.019-0.01-0.019,0.007-0.031c0.017-0.014,0.022-0.004,0.019,0.013   c-0.004,0.018,0.008,0.045,0.012,0.022c0.005-0.023-0.004-0.046,0.02-0.044l0.015-0.004l0.009-0.004   c0.018,0.009,0.035,0.007,0.036,0.03c0.003,0.023,0.034,0.036,0.015,0.043c-0.017,0.007,0.028,0.003,0.013,0.016l0.018,0.004   c0.019-0.001,0.049-0.002,0.056,0.013c0.013,0.027-0.009,0.025-0.031,0.021l-0.014,0.014c-0.003,0.008-0.006,0.017-0.022,0.014   c-0.031-0.006-0.002,0.036-0.028,0.038c-0.027,0.003,0.01,0.027-0.017,0.029c-0.026,0.001-0.024,0.042-0.005,0.051   c0.018,0.005,0.039,0.015,0.031,0.018l-0.007,0.009c0.005,0.009,0.035,0.015,0.015,0.031c0.022-0.004,0.036-0.009,0.04,0.018   c0.016-0.018,0.027-0.012,0.037-0.002l0.013,0.002l0.023,0.005c0.066,0.04-0.035,0.015,0.006,0.048l0.022,0.001h0.025   c0.022,0.013,0.053,0.023,0.063,0.008c0.01-0.016,0.026-0.008,0.046-0.001c0.018,0.007,0.033-0.003,0.063-0.006   c0.029-0.002,0.038-0.028,0.059-0.031c0.024-0.003,0.03,0.002,0.019,0.007L15.82,4.847L15.807,4.85   c-0.009,0.008-0.017,0.024,0.005,0.016c0.021-0.009,0.03-0.016,0.048-0.016c0.017,0,0.03-0.007,0.041,0.005l0.017-0.01   c0.003-0.009,0.008-0.02,0.026-0.013c0.039,0.016-0.015,0.022,0.029,0.044c0.019,0.009,0.01,0.027,0.045,0.032l0.023,0   c0.025,0-0.014-0.039,0.057-0.051c0.022-0.003,0.062-0.013,0.113-0.022c0.019-0.004,0.034-0.002,0.049,0.001   c0.022,0.002,0.042,0.005,0.068-0.01c0.029-0.017,0.037-0.032,0.102-0.04c0.047-0.005,0.107-0.002,0.131,0.004   c0.024,0.007,0.053,0.038,0.053,0.038l-0.005,0.007c0,0-0.041-0.046-0.029-0.01c0.002,0.008-0.004,0.023,0.013,0.034   c0.018,0.009,0.034,0.018,0.053,0.005l0.024-0.031l0.008,0.005l-0.026,0.036h0.004l0.012,0.002l0.023-0.035   c0.006-0.009,0.016-0.003,0.035-0.012l-0.013-0.004l-0.024-0.001l-0.015-0.013c0.001-0.012,0-0.017,0.023-0.011l0.025-0.002   l0.016-0.004c0.015,0.003,0.05-0.016,0.06-0.033c0.012-0.022,0.011-0.004,0.011,0.015c0.001,0.022,0.004,0.044,0.037-0.005   c0.003-0.027-0.024-0.015-0.02-0.095c-0.012-0.043-0.04-0.068-0.002-0.098c0.037-0.029-0.019-0.045,0.014-0.094   c0.032-0.047,0.017-0.01,0.077-0.056c0.039-0.03,0.039,0.002,0.048,0.002c0.015,0.001,0.026,0.04,0.056,0.042   c0.03,0.002,0.021,0.054,0.048,0.053c0.027,0,0.042,0.03,0.061,0.019c0.02-0.014,0.042,0.007,0.058-0.038   c0.007-0.029-0.022-0.058-0.019-0.085c0.009-0.052-0.023-0.056-0.028-0.039c-0.004,0.016-0.035,0.013-0.039-0.011   c-0.003-0.021-0.041-0.025-0.044-0.048l0.029-0.011c0,0-0.075-0.011-0.05-0.037c0.018-0.017-0.034-0.023,0.019-0.029   c0.051-0.004,0.028-0.036,0.067-0.025l0.02-0.004c0.004-0.005,0.006-0.009,0.024,0.001c0.017,0.01,0.021,0.003,0.025-0.004   c0.004-0.006,0.01-0.012,0.026-0.006c0.016,0.006,0.022,0.003,0.025,0c0.005-0.004,0.008-0.008,0.029,0.008   c0.017,0.012,0.02,0.009,0.026,0.005c0.006-0.004,0.013-0.008,0.04,0.014c0.035,0.027,0.053,0.025,0.074,0.021   c0.016-0.002,0.032-0.004,0.056,0.005c0.029,0.011,0.053,0.004,0.061-0.01c0.01-0.027-0.02-0.025-0.005-0.039l0.022,0.012   c0.01,0.012,0.018,0.023,0.018,0c0-0.021,0.014-0.015,0.03-0.01c0.016,0.006,0.034,0.012,0.041-0.013   c0.008-0.031,0.048-0.006,0.1,0l0.035-0.02v-0.02L17.736,4.16c-0.014-0.006-0.026-0.01-0.048,0   c-0.027,0.011-0.043-0.001-0.057-0.014c-0.014-0.011-0.028-0.022-0.05-0.015c-0.02,0.006-0.092-0.023-0.071-0.026   c0.02-0.003,0.042-0.04-0.038-0.003c-0.067,0.012-0.094,0.003-0.111-0.004c-0.016-0.009-0.022-0.016-0.043-0.004   c-0.043,0.024-0.076,0.02-0.099,0.018c-0.02-0.003-0.035-0.006-0.049,0.005c-0.024,0.02-0.043,0.014-0.056,0.009l-0.032,0.004   c-0.011,0.015-0.022,0.008-0.039,0c-0.016-0.008-0.035-0.014-0.063-0.004c-0.076,0.028-0.021,0.032-0.063,0.03   c-0.017-0.001-0.033,0.006-0.048,0.013l-0.04,0.012c-0.008-0.002,0.054-0.055,0.001-0.043c-0.046,0.01-0.03-0.034-0.027-0.05   c-0.061,0.043-0.061,0.022-0.061,0.003c-0.002-0.013-0.002-0.025-0.021-0.021c-0.055,0.014-0.02-0.017-0.042-0.042   c-0.025-0.026,0.014-0.041-0.006-0.052c-0.021-0.013-0.006-0.018-0.027-0.03c-0.023-0.014,0.002-0.021-0.018-0.034   c-0.021-0.014,0.018-0.011-0.006-0.032c-0.024-0.02,0.034-0.013-0.007-0.024c-0.028-0.008,0.011-0.041,0.019-0.029   c0.01,0.015,0.039-0.002,0.017-0.013c-0.022-0.011-0.003-0.012,0.017-0.018c0.019-0.006,0.013-0.013,0.03-0.003l0.022-0.015   c0.006-0.012,0.013-0.022,0.03-0.016l0.02-0.016c0.004-0.014,0.006-0.027,0.026-0.013l0.022-0.004l0.014-0.009l0.016-0.009   l0.02-0.009c0.03,0.004,0.028-0.02,0.062-0.027c0.034-0.007,0.023-0.015,0.048-0.038l0.025,0.001l0.024,0.004   c0.024-0.014-0.009-0.012-0.014-0.05c-0.007-0.044-0.12-0.036-0.143-0.06c-0.02-0.021-0.02-0.006-0.041-0.023   c-0.009,0.025-0.021,0.02-0.031,0.015l-0.015,0.003c-0.003,0.022-0.016,0.008-0.036-0.005c-0.015-0.01-0.032-0.021-0.05-0.013   c-0.017,0.006-0.027,0.005-0.033,0.004c-0.008-0.001-0.009-0.003-0.011,0.013L16.639,3.53c-0.011-0.004-0.027-0.007-0.047,0.016   c-0.037,0.042,0.043,0.029,0.003,0.079c-0.039,0.051-0.034,0.018-0.062,0.069C16.52,3.72,16.504,3.718,16.49,3.715   c-0.015-0.002-0.028-0.004-0.042,0.016c-0.014,0.023-0.021,0.021-0.029,0.019l-0.028,0.012c-0.014,0.015-0.029,0.011-0.046,0.007   c-0.016-0.004-0.034-0.008-0.051,0.009c-0.016,0.017-0.022,0.015-0.028,0.014c-0.004-0.002-0.008-0.004-0.018,0.015   c-0.01,0.017-0.024,0.008-0.033-0.001c-0.011-0.011-0.018-0.021-0.011,0.011c0.011,0.062-0.018,0.077-0.008,0.112   c0.009,0.035-0.054,0.069,0.035,0.132c0.053,0.038,0.048,0.026,0.045,0.015c-0.002-0.008-0.003-0.015,0.018-0.008   c0.048,0.017,0.016,0.022,0.074,0.04c0.057,0.018,0.064,0.045,0.036,0.047c-0.026,0.003-0.034,0.035-0.064,0.013   c-0.033-0.022-0.055-0.019-0.082-0.016c0.106,0.02,0.059,0.051,0.15,0.023c-0.03,0.066-0.048,0.063-0.058,0.061l-0.017,0.008   c-0.013,0.029-0.026,0.007-0.056-0.018c0.028,0.048-0.017,0.041-0.058,0.033c-0.024-0.005-0.047-0.01-0.053-0.003   c0.062,0.019,0.068,0.021,0.057,0.041c-0.011,0.022,0.021,0.021-0.016,0.046c-0.038,0.026,0.03,0.056-0.003,0.092   c-0.025,0.027,0.01,0.058-0.011,0.115c-0.003,0.009-0.001,0.072-0.059,0.07c-0.055-0.002-0.087-0.041-0.1-0.012l-0.014,0.006   c-0.006-0.005-0.013-0.01-0.027,0.026c-0.025,0.062,0.016,0.023,0,0.054c-0.009,0.017-0.028,0.011-0.051,0.004   c-0.022-0.006-0.047-0.012-0.072-0.001c-0.077,0.035-0.061-0.032-0.104-0.066c-0.043-0.033-0.037-0.039-0.045-0.061   c0.055,0.03,0.067-0.003,0.032-0.023c-0.036-0.021-0.001-0.014-0.044-0.04c-0.042-0.025-0.049-0.062-0.065-0.103   c-0.007-0.019-0.01-0.012-0.012-0.005c-0.004,0.009-0.007,0.017-0.019-0.023c-0.006-0.022-0.014-0.018-0.02-0.015   c-0.006,0.004-0.01,0.006-0.009-0.017c0.001-0.034-0.027,0.008-0.038-0.052c-0.01-0.061-0.076-0.043-0.013-0.061l-0.043-0.008   c-0.016,0.004-0.03,0.008-0.035-0.017c-0.011-0.043-0.019-0.058-0.015-0.091c-0.014,0.035,0.006,0.075-0.025,0.049   c0.028,0.042,0.029,0.074-0.006,0.079c-0.037,0.004-0.046,0.01-0.079-0.023c0.019,0.054-0.004,0.078-0.042,0.088   c-0.038,0.009-0.026,0.046-0.097,0.047c-0.071,0.002-0.065,0.034-0.104,0.009c-0.018-0.011-0.042-0.008-0.058-0.004   c-0.02,0.004-0.026,0.009,0.006-0.014c-0.066-0.009-0.119-0.011-0.045-0.038c-0.063,0.011-0.082,0-0.099-0.031   c-0.02-0.03-0.094-0.029-0.054-0.075c0.027-0.029,0.036-0.019,0.051-0.009l0.032,0.011c-0.044-0.045-0.039-0.031,0.025-0.098   c-0.088,0.028-0.044,0.038-0.085,0.05l-0.021-0.004c-0.003-0.008,0.001-0.016-0.033,0.029c-0.008-0.063,0-0.113,0.027-0.089   c0.028,0.022,0.054,0.004,0.044-0.02l-0.022-0.001c-0.012,0.005-0.023,0.01-0.018-0.013c0.004-0.02-0.003-0.014-0.011-0.009   c-0.008,0.006-0.017,0.011-0.013-0.013l-0.008,0.004c-0.01,0.006-0.028,0.013-0.036-0.028c-0.004-0.012,0.027,0,0.053-0.025   c-0.054,0.011-0.067-0.002-0.046-0.018c0.02-0.016-0.051-0.035,0.009-0.029c0.026,0.003,0.043,0,0.057-0.003   c0.017-0.004,0.029-0.008,0.052,0.001c0.022,0.007,0.027,0.004,0.034,0.002c0.009-0.003,0.02-0.006,0.053,0   c0.066,0.012,0.052-0.022,0.052-0.022s-0.01,0.022-0.07,0.007c-0.029-0.007-0.035-0.004-0.04-0.001   c-0.004,0.003-0.007,0.006-0.031-0.001c-0.029-0.009-0.044-0.004-0.06,0l-0.035,0.005c-0.039,0-0.054-0.06,0.032-0.049   C14.76,3.862,14.76,3.852,14.79,3.83l0.029-0.009l0.028-0.009c0.049-0.036,0.078-0.032,0.108-0.05   c0.029-0.018,0.04-0.024,0.077,0.002c-0.026-0.047-0.031-0.042,0.017-0.049c0.047-0.006,0.058-0.017,0.071,0.002   c0.011-0.027,0.06-0.04,0.092-0.022c-0.002-0.03,0.058-0.046,0.076-0.018c0.013-0.041-0.022-0.042,0.041-0.012   c0.031,0.013,0.04,0.011,0.048,0.008c0.01-0.003,0.021-0.006,0.061,0.01c-0.032-0.028-0.013-0.014,0.019-0.04   c-0.076,0.011-0.074,0.025-0.127,0.001c0.038-0.014-0.031-0.016,0.026-0.031c0.055-0.015,0.032-0.035,0.069-0.042   c0.038-0.007,0.02-0.019,0.061-0.045c0.04-0.026,0.01-0.046,0.061-0.061c0.05-0.015,0.042-0.051,0.083-0.061   c0.042-0.009,0.014-0.027,0.04-0.034c0.027-0.008,0.006-0.042,0.044-0.049c0.037-0.008,0.031-0.031,0.063-0.034   c0.033-0.001,0.003-0.027,0.076-0.027c0.074-0.001,0.036-0.024,0.067-0.034c0.032-0.01,0.011-0.041,0.063-0.05   c0.053-0.009,0.031-0.031,0.072-0.033c0.043-0.001,0.013-0.046,0.046-0.033c0.018,0.006,0.044-0.004,0.07-0.014   c0.025-0.009,0.049-0.019,0.065-0.015c0.017,0.004,0.026,0,0.036-0.005c0.011-0.005,0.025-0.011,0.051-0.002   c0.028,0.009,0.036,0.003,0.048-0.003c0.01-0.005,0.025-0.01,0.057-0.007c0.035,0.004,0.038-0.006,0.038-0.015   c0.001-0.01-0.002-0.02,0.026-0.016c0.023,0.004,0.031-0.002,0.038-0.01c0.008-0.008,0.013-0.017,0.04-0.002   c0.011,0.005,0.025,0.004,0.044,0.003c0.014-0.001,0.028-0.001,0.047,0c0.025,0.002,0.043-0.009,0.055-0.02   c0.022-0.018,0.034-0.035,0.063,0.007c0.032-0.059,0.062-0.063,0.095,0.017C16.937,2.936,16.795,3,16.893,2.942   c0.042-0.025,0.048-0.016,0.056-0.008c0.007,0.007,0.014,0.013,0.037,0.006c0.026-0.007,0.013,0.021,0,0.051   c-0.016,0.032-0.033,0.065,0.002,0.044c0.066-0.038,0.048-0.068,0.078-0.086c0.004-0.002,0.003,0.014,0.004,0.031   c0.001,0.019,0.005,0.037,0.023,0.029c0.033-0.015-0.025-0.071,0.046-0.055c0.072,0.015-0.01,0.068,0.021,0.053h0.026l0.023-0.006   c0.025-0.026,0.034-0.012,0.045,0.002l0.027,0.016c0.032-0.004,0.054-0.011,0.099,0.034c0.032,0.034-0.097,0.013-0.116,0.009   c0.05,0.015,0.046,0.018,0.102,0.032c0.026-0.006,0.051,0.002,0.07,0.01c0.026,0.01,0.04,0.021,0.03-0.004   c-0.019-0.044,0.103,0,0.106,0.012c0.003,0.006-0.027,0.004-0.053,0.003c-0.018-0.002-0.032-0.004-0.025-0.001   c0.021,0.007,0.096,0.033,0.114,0.029l0.017,0.003c0.009,0.004,0.018,0.007,0.036,0l0.029-0.003c0.018,0,0.045,0.001,0.096-0.005   c0.033-0.004,0.085,0.014,0.136,0.031c0.06,0.02,0.117,0.041,0.142,0.028c0.024-0.013,0.079,0.008,0.137,0.03   c0.058,0.022,0.117,0.044,0.15,0.031c0.035-0.013,0.086,0.006,0.129,0.025c0.033,0.015,0.062,0.03,0.075,0.028l0.025,0.011   l0.021,0.009c0.006,0,0.101,0.064,0.077,0.075c-0.011,0.005,0.018,0.015-0.006,0.025c-0.025,0.01-0.049,0.046-0.14,0.07   c-0.024,0.007-0.043-0.023-0.308-0.04c-0.342-0.022-0.245-0.1-0.292-0.064C17.915,3.41,17.906,3.4,17.897,3.391l-0.033-0.01   c-0.016,0.005-0.022,0-0.026-0.005c-0.005-0.006-0.01-0.011-0.028-0.003L17.78,3.368c-0.011-0.005-0.026-0.009-0.051-0.006   l-0.033-0.006c-0.016-0.005-0.021-0.012-0.017,0.008c0.004,0.031,0.129,0.02,0.129,0.038c0,0.005-0.027,0,0.029,0.016   c0.093,0.029-0.046,0.003,0.042,0.039c0.028,0.011,0.047,0.01,0.064,0.008c0.02-0.001,0.037-0.002,0.063,0.016   c0.023,0.017,0.036,0.015,0.045,0.013c0.008-0.002,0.012-0.004,0.016,0.013c0.009,0.033-0.021,0.025-0.006,0.043   c0.015,0.017-0.032,0.031,0.024,0.04c0.056,0.01-0.01,0.003,0.035,0.034c0.046,0.031-0.089,0.01,0.033,0.036   c0.06,0.013,0.084,0,0.113,0.027c0.026,0.027,0.131,0.009,0.179,0.042c0.025,0.017,0.014-0.025,0.042-0.026   c0.026-0.001-0.011-0.033-0.078-0.037c-0.138-0.01-0.056-0.024-0.104-0.042c-0.024-0.008,0.016-0.012,0.024-0.027   c0.006-0.009,0.013-0.004,0.034,0c0.013,0.003,0.032,0.005,0.058,0.005c0.041-0.001,0.041,0.008,0.034,0.015   c-0.008,0.011-0.03,0.021,0.008,0.013c0.07-0.015,0.102-0.006,0.127,0.003c0.023,0.008,0.038,0.017,0.071,0.007   c0.022-0.007,0.042-0.004,0.056,0l0.03,0c0.022-0.044-0.198-0.066-0.174-0.105c0.013-0.022,0.016,0.003,0.056-0.034   c0.03-0.028,0.031-0.014,0.107-0.033c0.091-0.022,0.099-0.013,0.106-0.003c0.004,0.005,0.007,0.011,0.024,0.011   c0.048-0.001,0.131-0.008,0.094,0.027c-0.021,0.019-0.01,0.011,0.008,0.004c0.017-0.006,0.038-0.013,0.05-0.002   c0.047,0.044,0.011-0.051,0.01-0.074c-0.001-0.02,0.01-0.024-0.046-0.027c-0.057-0.004,0.006-0.017-0.049-0.087   c-0.053-0.067-0.103-0.082-0.095-0.093c0.007-0.008,0.076,0.02,0.202,0.051c0.057,0.015-0.008,0.02,0.037,0.039   c0.046,0.02,0.109,0.064,0.024,0.047c-0.082-0.016-0.009,0.046,0.027,0.051c0.037,0.004,0.073,0.048,0.094,0.036l0.027,0.002   l0.034,0l0.026,0.003c0.008,0.005,0.018,0.009,0.038,0l0.028-0.001c0.006,0.004,0.008,0.009,0.017-0.016   c0.016-0.043,0.028,0.012-0.004-0.058c-0.02-0.043-0.015-0.036-0.003-0.029l0.024,0.002c0.015-0.016,0.332-0.061,0.366-0.061   c0.18,0.171,0.395,0.363,0.565,0.543c0.17,0.18,0.303,0.345,0.464,0.533c0.161,0.188,0.31,0.391,0.462,0.585   c0.152,0.196,0.277,0.403,0.417,0.606c0.142,0.201,0.24,0.402,0.369,0.611c0.13,0.208,0.227,0.459,0.345,0.673   c0.118,0.214,0.176,0.423,0.279,0.641c0.104,0.22,0.151,0.457,0.241,0.681c0.089,0.225,0.125,0.45,0.199,0.678   c0.074,0.229,0.104,0.472,0.162,0.707c-0.017-0.008-0.063-0.018-0.071-0.007c-0.012,0.017-0.023,0.005-0.049-0.007   c-0.026-0.012-0.065-0.025-0.131-0.01c-0.047,0.01-0.08-0.001-0.107-0.014c-0.021-0.01-0.041-0.02-0.061-0.017   c-0.069,0.01-0.067-0.059-0.118-0.114c-0.051-0.053,0.01-0.106-0.114-0.138c-0.07-0.018-0.1,0.002-0.124,0.023   c-0.018,0.016-0.034,0.032-0.06,0.029c-0.025-0.002-0.046,0.004-0.066,0.01c-0.031,0.009-0.061,0.019-0.103-0.003   c-0.028-0.014-0.048-0.011-0.067-0.007c-0.027,0.005-0.051,0.009-0.088-0.042c-0.059-0.086-0.061-0.017-0.102-0.093   c-0.012-0.021-0.017-0.021-0.023-0.02c-0.005,0-0.013,0.001-0.031-0.03c-0.019-0.033-0.034-0.007-0.075-0.039   c-0.04-0.033-0.046,0.016-0.059-0.068c-0.015-0.086-0.092-0.091-0.096-0.133c-0.006-0.042-0.046,0.01-0.11-0.093   c-0.05-0.082-0.065-0.072-0.084-0.062c-0.013,0.007-0.028,0.014-0.055-0.007c-0.049-0.037-0.056-0.03-0.055-0.062   c-0.02,0.029,0.016,0.038-0.027,0.058c-0.044,0.022-0.012,0.068-0.069-0.002c-0.036-0.043-0.041-0.005-0.045,0.001   c0.084,0.022,0.035,0.059,0.054,0.071c0.032,0.019-0.081,0.018-0.057,0.102c0.035-0.019,0.046-0.005,0.124,0.119   c0.077,0.125,0.072,0.129,0.072,0.171c0.032-0.039,0.086-0.007,0.061,0.008c-0.024,0.016,0,0.003,0.057,0.058   c0.056,0.053,0.071,0.017,0.082,0.067c0.004,0.021,0.039,0.004,0.031,0.078c-0.007,0.042,0.034,0.075,0.045,0.114   c0.009,0.04,0.033,0.055,0.079,0.1c-0.054-0.109-0.046-0.115-0.031-0.13l0.013,0.007l0.011,0.003   c0.014-0.026,0.033-0.074,0.057-0.05c0.019,0.02,0.101,0.087,0.065,0.112c-0.03,0.02,0.035,0.081,0.006,0.113   c-0.014,0.017-0.006,0.016,0.002,0.014l0.004,0.011c-0.024,0.029-0.016,0.028,0.01,0.019c0.036-0.017,0,0.064,0.07,0.089   c0,0,0.017-0.02,0.125-0.009c0.049,0.005,0.053,0.002,0.054-0.001c0.001-0.002-0.001-0.005,0.028-0.001   c0.03,0.003,0.035-0.002,0.038-0.006c0.003-0.005,0.002-0.01,0.024-0.005c0.022,0.004,0.023-0.001,0.023-0.006   c0.002-0.005,0.002-0.01,0.022-0.006c0.04,0.008-0.025-0.013,0.035-0.054c0.151-0.107,0.082-0.137,0.154-0.177   c0.073-0.041,0.011-0.079,0.078-0.072c0.067,0.006-0.025,0.101,0.027,0.093c0.053-0.01-0.013,0.051,0.047,0.126   c0.06,0.073,0.111,0.07,0.116,0.113c0.002,0.018,0.138,0.071,0.18,0.108c0.04,0.036,0.059,0.033,0.072,0.029   c0.011-0.004,0.017-0.007,0.03,0.021c0.014,0.028,0.024,0.027,0.031,0.026c0.008,0,0.014-0.001,0.018,0.038   c0.008,0.074,0.064,0.106,0.079,0.101C23.234,10.088,23.258,10.132,23.229,10.144z M15.422,6.791   c0.009,0.004,0.022,0.008,0.043,0.001c0.018-0.007,0.007-0.025,0.036-0.029c0.013-0.002,0.025-0.013,0.034,0.005   c0.01,0.021,0.012,0.035,0.022,0.043l0.015,0.056c0.026,0.032-0.015,0.034-0.005,0.05c0.011,0.016,0.011,0.035,0,0.052   c-0.008,0.014,0.009,0.025-0.001,0.041c-0.012,0.019,0.01,0.06-0.007,0.066l-0.025-0.012l-0.021-0.012   c-0.01,0.005,0.021,0.056-0.007,0.048l-0.03,0.001l-0.008,0c0.009-0.011-0.041-0.024-0.039-0.048   c0.007-0.056-0.011-0.094,0.006-0.096c0.031-0.005-0.02-0.019-0.001-0.039c0.017-0.02,0.008-0.059-0.008-0.064   c-0.015-0.005-0.03-0.022-0.025-0.034l0.007-0.032L15.422,6.791z M15.411,6.571c-0.022-0.008,0.023-0.017,0.004-0.03   c-0.019-0.014,0.03-0.003,0.032-0.017c0.004-0.017,0.013-0.016,0.023-0.015c0.01,0.001,0.022,0.002,0.03-0.014   c0.015-0.029,0.017-0.024,0.018,0.017c0,0.017,0.009,0.038,0.013,0.059c0.008,0.034,0.011,0.065-0.003,0.097   c-0.013,0.03-0.006,0.036-0.017,0.072l-0.013-0.013l-0.026-0.02c-0.025,0.006-0.028-0.007-0.029-0.02l-0.01-0.022   c-0.021,0.004,0.007-0.048-0.014-0.049C15.399,6.616,15.432,6.58,15.411,6.571z M16.402,7.414   c-0.021,0.025-0.011,0.053-0.025,0.044c-0.019-0.011-0.034-0.01-0.047-0.01l-0.027-0.007c-0.013-0.017-0.031-0.042-0.082-0.038   c-0.051,0.002-0.054-0.036-0.08-0.046c-0.026-0.011-0.042-0.036-0.071-0.039c-0.03-0.002-0.07-0.023-0.044-0.049   c0.025-0.026,0.038-0.045,0.06-0.032c0.019,0.013,0.035,0.009,0.049,0.005l0.036,0.001c0.024,0.018,0.026,0.002,0.051,0.017   l0.035-0.005l0.035-0.004l0.032-0.009c0.014-0.008,0.026-0.016,0.043-0.006c0.017,0.011,0.026,0.005,0.034-0.001l0.017-0.007   l0.02-0.003l0.014,0.004c-0.008,0.043-0.01,0.056-0.038,0.077c-0.025,0.023,0.01,0.031-0.012,0.047   C16.382,7.368,16.424,7.39,16.402,7.414z M15.224,4.479l0.026-0.023l0.019-0.008l0.012-0.003l0.013,0.006h0.027   c0.024-0.02,0.032-0.039,0.061-0.041c0.031-0.004,0.031-0.019,0.045-0.015c0.014,0.004-0.012,0.011,0.001,0.031   c0.014,0.019-0.007,0.036-0.011,0.046c-0.004,0.01-0.002,0.05-0.014,0.02c-0.014-0.029-0.029-0.028-0.049-0.036   c-0.021-0.007-0.013,0.007-0.035,0.01l-0.022-0.002l-0.027,0.002c-0.034,0.023-0.003,0.059-0.024,0.043   C15.236,4.489,15.238,4.477,15.224,4.479z M15.505,4.7c0.009,0.028,0.025,0.02,0.009,0.036c-0.016,0.017-0.058,0.009-0.077-0.005   c-0.017-0.01-0.03-0.006-0.037-0.013L15.396,4.7l0.038-0.004c0.023-0.005,0.043-0.008,0.046,0.004l0.01-0.003L15.505,4.7z    M15.606,4.624c-0.022-0.014,0.012-0.006,0.027-0.001c0.015,0.003,0.016,0.046,0.024,0.014c0.003-0.017,0.006-0.009,0.009,0   c0.002,0.009,0.006,0.017,0.011-0.001c0.006-0.023-0.009-0.022-0.02-0.022l-0.005-0.005c0.014-0.015,0.011-0.023,0.041-0.02   c0.026,0.003,0.003,0.009,0.01,0.032c0.008,0.022,0.013,0.036-0.014,0.046c-0.026,0.009,0.038,0.033,0.005,0.046   c-0.034,0.015-0.025,0.029-0.015,0.046c0.009,0.017-0.035-0.005-0.069-0.01c-0.033-0.007,0.013-0.005,0.017-0.022l-0.026,0.001   c-0.017,0.005-0.037,0.01-0.044-0.002c-0.013-0.018,0.004-0.044-0.018-0.06c-0.017-0.012,0.032-0.02,0.057-0.023   C15.617,4.639,15.627,4.637,15.606,4.624z"></path><path d="M6.336,3.089h0.032C6.345,3.079,6.328,3.088,6.336,3.089z"></path><path d="M7.853,2.598l0.002,0.003C7.89,2.635,7.877,2.619,7.853,2.598z"></path><path d="M13.641,4.508L13.641,4.508C13.656,4.512,13.68,4.509,13.641,4.508z"></path><path d="M7.763,14.024l-0.031,0.005C7.696,14.058,7.725,14.051,7.763,14.024z"></path></g></svg>`

class FlyHomeController {
  onAdd(map) {

    this._container = document.createElement('div')
    this._container.classList = 'mapboxgl-ctrl mapboxgl-ctrl-group'
    this.flyhome_button = document.createElement('button')
    this.flyhome_button.innerHTML = world_svg
    this.flyhome_button.addEventListener('click', function(e){
      map.flyTo({
        center:[0,0],
        zoom:1,
        bearing:0.001,
        pitch:0.001
      })
    })
    this._container.appendChild(this.flyhome_button)
    return this._container;
  }
 
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}


class SlideShowControls {
  onAdd(map){
    this._map = map
    this._container = document.createElement('div')
    this._container.classList = 'mapboxgl-ctrl mapboxgl-ctrl-group'
    this.map_container = document.querySelector('geo-map')

    const next = document.createElement('button')
    const next_label = document.createElement('span')
    next_label.classList = 'mapbox-ctrl-icon'
    next_label.innerHTML = `<svg height='16px' width='16px'  fill="#2d2d2d" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" x="0px" y="0px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve"><path d="M17.365,16.01l-6.799,6.744c-0.746,0.746-0.746,1.953,0,2.699c0.754,0.745,1.972,0.745,2.726,0l8.155-8.094  c0.746-0.746,0.746-1.954,0-2.699l-8.155-8.094c-0.754-0.746-1.972-0.744-2.726,0c-0.746,0.745-0.746,1.952,0,2.698L17.365,16.01z"></path></svg>` 
    next.appendChild(next_label)
    this._container.appendChild(next)
    next.addEventListener('click', ()=>
      this.map_container.dispatchEvent( new CustomEvent('NEXT SLIDE'))
    )

    const home = document.createElement('button')
    const home_label = document.createElement('span')
    home_label.classList = 'mapbox-ctrl-icon'
    home_label.innerHTML = `<svg height='16px' width='16px'  fill="#2d2d2d" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" x="0px" y="0px"><g data-name="34 Home"><path d="M27,29.5H5A1.5,1.5,0,0,1,3.5,28V13.43A1.5,1.5,0,0,1,4,12.29L15,2.86a1.51,1.51,0,0,1,2,0l11,9.43a1.5,1.5,0,0,1,.52,1.14V28A1.5,1.5,0,0,1,27,29.5Zm-20.5-3h19V14.12L16,6,6.5,14.12Z"></path></g></svg>`
    home.appendChild(home_label)
    this._container.appendChild(home)
    home.addEventListener('click', ()=> 
      this.map_container.dispatchEvent( new CustomEvent('SHOW HOME'))
    )

    const prev = document.createElement('button')
    const prev_label = document.createElement('span')
    prev_label.classList = 'mapbox-ctrl-icon'
    prev_label.innerHTML = `<svg height='16px' width='16px'  fill="#2d2d2d" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0" x="0px" y="0px" viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve"><path d="M14.647,16.011l6.799-6.744c0.746-0.746,0.746-1.953,0-2.699c-0.754-0.745-1.972-0.745-2.726,0l-8.155,8.094  c-0.746,0.746-0.746,1.954,0,2.699l8.155,8.094c0.754,0.746,1.972,0.744,2.726,0c0.746-0.745,0.746-1.952,0-2.698L14.647,16.011z"></path></svg>`
    prev.appendChild(prev_label)
    this._container.appendChild(prev)
    prev.addEventListener('click', () => 
      this.map_container.dispatchEvent( new CustomEvent('PREV SLIDE'))
    )

    return this._container

  }

  onRemove(){
    this._container.remove()
    this._map = undefined
  }
}


class MapData extends HTMLElement {
  connectedCallback(){
    this.style.display = 'none'
    this.src = this.getAttribute('src')
    if(this.src === null){
      const src_error = `
        Error: This element requires the attribute src to work.  
        Please consult the readme for more information`
      this.innerHTML = `<error> ${src_error} </error>`
      return new Error(src_error)
    }
    this.removeAttribute('src')
    this.initialize()
  }

  async initialize(){
    this.fetchStoriesFromURL(this.src)
  }
  
  static get observedAttributes() {
    return [];
  }

  attributeChangedCallback(name, old_value, new_value){
    switch(name){
      default:
    }
  }

  async fetchStoriesFromURL(url){
    function generateLocationDiv(story_location){
      let story_location_image = ''
      if(story_location.image_link && story_location.image_link !== 'NaN'){
        story_location_image = `<img src="${story_location.image_link}" style="width:100%; height:auto" />`   
      }
      return `
        <map-location id="story_location-${story_location.id}"
          latitude="${story_location.latitude}"
          longitude="${story_location.longitude}"
          zoom="${story_location.zoom}"
          pitch="${story_location.pitch}"
          bearing="${story_location.bearing}"
          title="${_.escape(story_location.title)}"
          originator="${story_location.originator}"
          location_name="${story_location.location}"
        >
        <h2>${story_location.location}</h2>
        ${story_location_image}
          <h1>${_.escape(story_location.title)}</h1>
          <small>Latitude:${story_location.latitude.toFixed(2)}, Longitude:${story_location.longitude.toFixed(2)}</small>
          <p><a style="text-decoration:none;" href="${story_location.description_link}" target="_blank"> ${_.escape(story_location.description)}</a></p>
          <cite><a href="${story_location.citation_link}">${_.escape(story_location.citation)}</a></cite>
        </map-location>`
    }

    fetch(url).then(res => res.json()).then(res => {
      let update = ''
      res.markers.forEach(story_location => {
        update += generateLocationDiv(story_location)
      })
      const location_container = document.createElement('div')
      location_container.innerHTML = update
      this.appendChild(location_container)
      dispatchMapEvent('SHOW HOME')
    })
  }
}

customElements.define('map-data', MapData)

class MapInformationBox extends HTMLElement {
  connectedCallback(){
    const close_button = document.createElement('button')
    close_button.classList.add('close-button')
    close_button.innerText = 'x'
    close_button.addEventListener('click', (e) => {
      this.remove()
    })
    this.prepend(close_button)
  }
}

customElements.define('map-information-box', MapInformationBox)

class MapNotification extends HTMLElement {
  connectedCallback(){
    const close_button = document.createElement('button')
    close_button.classList.add('close-button')
    close_button.innerText = 'x'
    close_button.addEventListener('click', (e) => {
      this.remove()
    })
    this.prepend(close_button)
  }
}

customElements.define('map-notification', MapNotification)


