'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const btnsortContainer = document.querySelector('.btn_sort_container');
//const map = document.querySelector('#map');

//HOW TO PLAN A WEB PROJECT
//1) USER STORIES(descrizione funzionalità app da prospettiva utente)

//AS a [type of user] I want [what] so that [why]
//2)features
//3)flowchart
//4)architecture

class Workout {
  date = new Date(); //data dell'allenamento
  id = (Date.now() + '').slice(-10);
  constructor(coords, distance, duration) {
    this.coords = coords; //[lat,lng]
    this.distance = distance; //in km
    this.duration = duration; //in minutes
  }
  _setWorkoutDescription() {
    this.workoutDate = `${this.type[0].toUpperCase()}${this.type.slice(
      1
    )} on ${new Intl.DateTimeFormat('en-EN', {
      month: 'long',
      day: '2-digit',
    }).format(this.date)}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setWorkoutDescription();
  }

  calcPace() {
    //min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setWorkoutDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

//////////////////////////////////////////
//APPLICATION ARCHITECTURE
class App {
  #previousselected;
  #mapzoomLevel = 13;
  #map;
  #layersgroup; //oggetto che contiene tutte info su marker aggiunti alla mappa
  #layersarr;
  //#sorted = 'descending'; //default decrescente. in realtà non è ne uno ne l'altro. ma uso variabile per togglare tra ordine crescente e decrescente
  #mapevent;
  #workouts = []; //where all workouts are going to be stored
  constructor() {
    //GEOLOCATION API
    this._getPosition();

    //RETRIEVE WORKOUTS FROM LOCALSTORAGE
    this._loadWorkoutsFromLocalStorage();

    //EVENT LISTENERS
    //this in constructor function vale come l'oggetto che mi restituirà
    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToMarker.bind(this));

    containerWorkouts.addEventListener('change', this._CrudWorkout.bind(this));

    btnsortContainer.addEventListener('click', this._sortworkouts.bind(this));
  }
  _getPosition() {
    console.log('VALORE THIS', this);
    //GEOLOCATION API
    if (navigator.geolocation) {
      const errorfn = function (err) {
        const { message } = err;
        console.error(message);
      };
      //QUI THIS VALE OGGETTO APP
      //QUESTA FUNZIONE VIENE INFATTI CHIAMATA DENTRO CONSTRUCTOR
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        errorfn,
        {
          enableHighAccuracy: true,
        }
      );
    }
  }
  _loadMap(position) {
    //success callback GEOLOCATION API
    console.log(position);
    const { latitude, longitude } = position.coords;
    console.log(`https://www.google.it/maps/@${latitude},${longitude}`);

    //stringa map è id elemento HTML dove mappa verrà mostrata
    //L è namespace di Leaflet

    //this qui è undefined. funzione loadmap è tratta come una normale chiamata
    //ad una funzione. essendo in strict mode this poi vale undefined.
    //quindi lo fixo settando il valore di this manualmente
    this.#map = L.map('map').setView([latitude, longitude], this.#mapzoomLevel); //13 indica lo Zoom
    this.#layersgroup = L.featureGroup();

    //leaflet è solo un visualizzatore. la mappa visualizzata è quella passata a metodo
    //tile layer
    /*L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);*/

    //Leaflet con Google Maps
    const basemap = L.tileLayer(
      'http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    ).addTo(this.#map);

    const streetsmap = L.tileLayer(
      'http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    );

    const terrainmap = L.tileLayer(
      'http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      }
    );
    const openStreetmap = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }
    );

    const baseMaps = {
      'Google satelite map': basemap,
    };

    const overlaymaps = {
      'Google terrain map': terrainmap,
      'Google street map': streetsmap,
      OSM: openStreetmap,
    };

    const layerControl = L.control
      .layers(baseMaps, overlaymaps)
      .addTo(this.#map);

    //L è variabile globale che sarà disponibile a mio script. ad esempio posso creare uno script dentro qui
    //e linkarlo e varaibile globale definita in altro script sarà visibile qua,
    //a patto che questo secondo script sia caricato prima del mio script(o dello script dove lo voglio usare)

    //L.marker([latitude, longitude]).addTo(map).bindPopup('Sei Qui').openPopup();

    //RENDER MARKER FROM LOCALSTORAGE WORKOUTS
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
    this._showAllWorkouts();
    this.#map.addEventListener('click', this._showForm.bind(this));
    //anche qua devo bindare il this sennò mi risulta uguale a event.target in quanto
    //showform è un listener attaccato ad un elemento nel DOM
  }
  _showAllWorkouts() {
    this.#layersarr = this._getLayers();
    const bounds = this.#layersgroup.getBounds();
    if (bounds.isValid()) this.#map.fitBounds(bounds);
    //zoom per fare in modo che mappa mostri tutti marker che ci sono
  }
  _showForm(mapE) {
    //mostro form
    form.classList.remove('hidden');
    inputDistance.focus();
    this.#mapevent = mapE;
  }
  _hideForm() {
    //pulire input form e rimuove form da visibile
    inputDistance.value =
      inputCadence.value =
      inputDuration.value =
      inputElevation.value =
        '';

    //risolvere problema animazione form quando lo nascondo
    //non voglio effetto scivola verso l'alto in seguito ad aggiunta classe hidden
    form.style.display = 'none'; //property display in css non è animabile
    //quindi animazione non viene triggerata o meglio è subito interrotta
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }
  _moveToMarker(event) {
    //cliccando su allenamento voglio spostare la mappa li

    const workoutEL = event.target.closest('.workout');
    if (!workoutEL) return;
    const workout = this._findworkout(workoutEL.dataset.id);
    if (!workout) return;
    console.log(workout);
    this.#map.setView(workout.coords, this.#mapzoomLevel, {
      animate: true,
      pan: { duration: 1 },
    });
  }
  _toggleElevationField(workout, editmode = false) {
    if (editmode) {
      inputCadence
        .closest('.form__row')
        .classList.toggle('form__row--hidden', workout.type === 'cycling');
      inputElevation
        .closest('.form__row')
        .classList.toggle('form__row--hidden', workout.type === 'running');
    } else {
      inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.toggle('form__row--hidden');
    }
  }
  _noWhiteSpaceinputs(...inputs) {
    return inputs.every(input => input.replaceAll(' ', '').length > 0);
  }
  _allPositiveInputs(...inputs) {
    //validazione input
    return inputs.every(input => input > 0);
  }
  _allValidInputs(...inputs) {
    //validzione input
    return inputs.every(input => Number.isFinite(input));
  }
  _UpdateObj(newType, toUpdate) {
    //toUpdate è oggetto da aggiornare
    //newType è valore dropdown tipologia allenamento
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let { type: tipowork } = toUpdate;
    const toUpdateCopy = { ...toUpdate };
    //CASO TIPOLOGIA DIVERSA DA VECCHIO A WORKOUT MODIFICATO
    if (newType === 'running' && tipowork === 'cycling') {
      const newObj = new Running(
        [...toUpdateCopy.coords],
        distance,
        duration,
        +inputCadence.value
      );

      newObj.date = new Date(toUpdateCopy.date); //voglio mantenere la data originale dell'allenamento
      newObj._setWorkoutDescription();
      //remove old workout from localstorage
      //this._deleteworkout(obj.id);

      return newObj;
    }
    if (newType === 'cycling' && tipowork === 'running') {
      const newObj = new Cycling(
        [...toUpdateCopy.coords],
        distance,
        duration,
        +inputElevation.value
      );
      newObj.date = new Date(toUpdateCopy.date);
      newObj._setWorkoutDescription();
      //remove old workout from localstorage
      //this._deleteworkout(obj.id);

      return newObj;
    }
    //CASO STESSA TIPOLOGIA WORKOUT DA VECCHIO A NUOVO(aggiorno solo i Dati)
    if (newType === tipowork) {
      if (tipowork === 'running') {
        toUpdateCopy.distance = distance;
        toUpdateCopy.duration = duration;
        toUpdateCopy.cadence = +inputCadence.value;
        //this._deleteworkout(obj.id);

        return toUpdateCopy;
      }
      if (tipowork === 'cycling') {
        toUpdateCopy.distance = distance;
        toUpdateCopy.duration = duration;
        toUpdateCopy.elevationGain = +inputElevation.value;
        //this._deleteworkout(obj.id);

        return toUpdateCopy;
      }
    }
  }
  _createNewWorkout(workouttype, latitude, longitude) {
    //metodo chiamato in fase di creazione
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    if (workouttype === 'running') {
      const cadence = +inputCadence.value;
      return new Running([latitude, longitude], distance, duration, cadence);
    }
    if (workouttype === 'cycling') {
      const elevation = +inputElevation.value;
      return new Cycling([latitude, longitude], distance, duration, elevation);
    }
  }
  _newWorkout(e) {
    e.preventDefault();

    //get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let isCreatemode = this.#mapevent?.latlng;
    let toUpdate;
    let lat, lng;

    let workout;
    //check if values are valid

    if (!this._handleValidation())
      return alert('Inputs must be valid and positives');
    //chiama funzioni validazione e mostra alert in cado di errore
    if (isCreatemode) {
      lat = this.#mapevent.latlng.lat;
      lng = this.#mapevent.latlng.lng;
      workout = this._createNewWorkout(type, lat, lng);
      //add this object to workouts array
      this.#workouts.push(workout);
      console.log(workout);
      this._renderWorkoutMarker(workout);
      this._renderWorkoutList(workout);
    }
    if (!isCreatemode) {
      const workoutEl = this.#previousselected.closest('.workout');
      if (!workoutEl) return;
      toUpdate = this._findworkout(workoutEl.dataset.id);
      const updated = this._UpdateObj(type, toUpdate);
      this._removeMarker(toUpdate);
      const index = this.#workouts.indexOf(toUpdate);
      if (index >= 0) {
        this.#workouts[index] = updated;
        //nasconde workout dal DOM
        this._removeWorkoutFromList(toUpdate.id);

        this._renderWorkoutList(updated);
        this._renderWorkoutMarker(updated);
      } else return alert('unable to find workout');
    }

    //hide form and clear inputs
    this._hideForm();

    //save workouts to localStorage
    this._saveWorkoutstoLocalStorage();
  }
  _handleValidation() {
    //Validazione input
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    if (type === 'running') {
      const cadence = +inputCadence.value;
      if (
        !this._allValidInputs(distance, duration, cadence) ||
        !this._allPositiveInputs(distance, duration, cadence) ||
        !this._noWhiteSpaceinputs(
          inputDistance.value,
          inputDuration.value,
          inputCadence.value
        )
      )
        return false;
    }
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !this._allValidInputs(distance, duration, elevation) ||
        !this._allPositiveInputs(distance, duration, elevation) ||
        !this._noWhiteSpaceinputs(
          inputDistance.value,
          inputDuration.value,
          inputElevation.value
        )
      )
        return false;
    }
    return true;
  }
  _removeMarker(obj) {
    this.#layersarr = this.#layersgroup.getLayers();
    const result = this.#layersarr.find(
      x => x._latlng.lat === obj.coords[0] && x._latlng.lng === obj.coords[1]
    );
    if (!result) return false;
    /*console.log(result instanceof L.Layer());
    this.#map.removeLayer(result);
    this.#layersarr = this.#layersgroup.getLayers();
    console.log(this.#layersarr);*/
    result.removeFrom(this.#map);
    result.removeFrom(this.#layersgroup);
    this.#layersarr = this._getLayers();
    return true;
  }
  _getLayers() {
    return this.#layersgroup.getLayers();
  }
  _saveWorkoutstoLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _loadWorkoutsFromLocalStorage() {
    const savedWorkouts = JSON.parse(localStorage.getItem('workouts'));
    if (!savedWorkouts) return;
    if (savedWorkouts.length === 0) this._hidesortbar();
    this.#workouts = savedWorkouts;
    this.#workouts.forEach(work => {
      this._renderWorkoutList(work);
    });
  }
  _renderWorkoutMarker(workout) {
    //crea un marker, aggiunge un popup(bindpopup) e lo apre
    //argomenti passabili a bindPopup: stringa, HtmlElement,Function, Popup
    const marker = L.marker(workout?.coords, {
      riseOnHover: true,
    })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false, //non far chiudere popup quando ne apro un'altro
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}${workout.workoutDate}`
      )
      .openPopup();

    this.#layersgroup.addLayer(marker);
  }
  _renderWorkoutList(workout) {
    //containerWorkouts.innerHTML = '';
    //questo primo html è ciò che sia running che cycling hanno in comune

    /*       <svg class='workout__icon_more' version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
	 viewBox="0 0 500 500" enable-background="new 0 0 500 500">
   <g>
     <path d="M250,186c-7.7,0-14,6.3-14,14s6.3,14,14,14s14-6.3,14-14S257.7,186,250,186z"/>
     <path d="M186,186c-7.7,0-14,6.3-14,14s6.3,14,14,14s14-6.3,14-14S193.7,186,186,186z"/>
     <path d="M314,186c-7.7,0-14,6.3-14,14s6.3,14,14,14s14-6.3,14-14S321.7,186,314,186z"/>
   </g>
   </svg>*/

    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.workoutDate}</h2>
      <select class='form__input_options'>
      <option>--</option>
      <option>Edit</option>
      <option>Delete current</option>
      <option>Delete All</option>
      </select>
     


      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
    </div>`;
    //check if workout is running or Cycling
    workout.type === 'running'
      ? (html += `<div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(2)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>`)
      : (html += `<div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.speed.toFixed(
                      2
                    )}</span>
                    <span class="workout__unit">km/h</span>
                  </div>
                  <div class="workout__details">
                    <span class="workout__icon">⛰</span>
                    <span class="workout__value">${workout.elevationGain}</span>
                    <span class="workout__unit">m</span>
                  </div>
                </li>`);

    form.insertAdjacentHTML('afterend', html);
  }
  _CrudWorkout(event) {
    if (!event.target.classList.contains('form__input_options')) return;
    const option = event.target.value;
    //Gestione cambio di più select
    if (this.#previousselected) {
      this.#previousselected.value = '--';
      this.#previousselected = event.target;
    } else {
      this.#previousselected = event.target;
    }
    //console.log(this.#previousselected);

    switch (option) {
      case '--':
        this._hideForm();
        event.target.blur();
        break;
      case 'Edit':
        this._editWorkout();
        break;
      case 'Delete current':
        let id = this.#previousselected.closest('.workout').dataset.id;
        this._deleteworkout(id);
        break;
      case 'Delete All':
        break;
      default:
        alert('Invalid option');
        break;
    }
  }
  _editWorkout() {
    this._showForm();
    this.#previousselected.value = 'Edit';
    const toEditEL = this.#previousselected.closest('.workout');
    if (!toEditEL) return;
    const workout = this._findworkout(toEditEL.dataset.id);
    if (!workout) {
      console.error('unable to find workout');
      this._hideForm();
      return;
    }
    //console.log(toEdit);
    this._setFormvalues(workout);
  }
  _setFormvalues(workout) {
    //setta valori form in base a workout da editare
    this._toggleElevationField(workout, true);
    if (workout.type === 'running') {
      inputType.value = 'running';
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;
      inputCadence.value = workout.cadence;
    }
    if (workout.type === 'cycling') {
      inputType.value = 'cycling';
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;
      inputElevation.value = workout.elevationGain;
    }
  }
  _findworkout(id) {
    return this.#workouts.find(work => work.id === id);
  }
  _removeWorkoutFromList(id) {
    const toDeleteEL = document.querySelector(`[data-id="${id}"]`);
    if (toDeleteEL) {
      toDeleteEL.style.display = 'none';
    }
  }

  _deleteworkout(id) {
    if (!id) return;
    const todelIndex = this.#workouts.findIndex(work => work.id === id);
    if (todelIndex >= 0) {
      const toDeleteEL = document.querySelector(`[data-id="${id}"]`);
      if (toDeleteEL) toDeleteEL.style.display = 'none';
      this._removeMarker(this.#workouts[todelIndex]);
      this.#workouts.splice(todelIndex, 1);
      if (this.#workouts.length === 0) this._hidesortbar();
      this._saveWorkoutstoLocalStorage();
    } else console.error('Unable to remove workout');
  }
  _deleteAllWorkouts() {
    localStorage.removeItem('workouts');
    this.#workouts = [];
  }
  _sortworkouts(event) {
    const clicked = event.target.closest('.btn_sort');
    if (!clicked) return;
    /*const order = this.#sorted;
    if (order === 'ascending') this.#sorted = 'descending';
    if (order === 'descending') this.#sorted = 'ascending';*/

    const option = clicked.dataset.option;
    const order = clicked.dataset.order;

    if (order === 'ascending') clicked.dataset.order = 'descending';

    if (order === 'descending') clicked.dataset.order = 'ascending';

    document.querySelectorAll('.workout').forEach(work => work.remove());

    if (option === 'date') {
      this.#workouts
        .slice()
        .sort((a, b) =>
          clicked.dataset.order === 'descending'
            ? new Date(a[option]).valueOf() - new Date(b[option]).valueOf()
            : new Date(b[option]).valueOf() - new Date(a[option]).valueOf()
        )
        .reverse()
        .forEach(work => this._renderWorkoutList(work));
    } else {
      this.#workouts
        .slice()
        .sort((a, b) =>
          clicked.dataset.order === 'descending'
            ? a[option] - b[option]
            : b[option] - a[option]
        )
        .reverse() //devo ribaltare array ordinato per fare in modo che venga visualizzato ordinato.(colpa di afterend in metodo renderworkoutlist)
        .forEach(work => this._renderWorkoutList(work));

      //problema sta nel metodo renderworkoutlist. inserirsce html al termine del form
    }
  }
  _hidesortbar() {
    btnsortContainer.style.display = 'none';
  }

  reset() {
    //svuota localstorage e ricarica la pagina
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

/*
ALTRE FEATURE DA FARE
edit workout
delete single workout
delete all workouts
sort workouts by certain fields
creare avvisi per errori
position the map to show all workouts
usare API di terze parti per ottenere nome luogo da coordinate
usare API di terze parti per mostrare meteo per quel workout a quelle coordinate e giorno
*/
