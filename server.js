const express = require('express');
const app = express();
const port = 3000

const pgp = require('pg-promise')()
const db = pgp('postgres://tester:pwd@localhost:5432/slovakia_geo')

const bodyParser = require('body-parser');
var jsonParser = bodyParser.json({ type: 'application/json'});

const VIEW_PATH = 'C:\\Users\\Patrik\\Desktop\\ING1\\PDT\\project\\myIndex.html';

// API

app.get('/api/get-regions', async function (req, res) {
    db.many("\
        SELECT\
            ST_AsGeoJSON(ST_Transform(way, 4326)) AS geo,\
            ROUND(ST_Area(ST_Transform(way, 2163)) / 1000000) AS area,\
            name,\
            osm_id \
        FROM\
            planet_osm_polygon\
        WHERE\
            name LIKE 'okres %'\
    ")
    .then(function (data) {
        features = [];
        for(var i=0; i<data.length; i++) {
            features.push({
                "type": "Feature",
                "geometry": JSON.parse(data[i].geo),
                "properties": {
                    "osm_id": data[i].osm_id,
                    "name": data[i].name,
                    "area": data[i].area
                }
            });
        }
        res.json(features);
    })
    .catch(function (error) {
        console.log('ERROR:', error);
    })
})

app.get('/api/get-regions-advanced', async function (req, res) {
    db.many("\
        SELECT\
            * \
        FROM\
            extended_regional_stats\
    ")
    .then(function (data) {
        features = [];
        for(var i=0; i<data.length; i++) {
            features.push({
                "type": "Feature",
                "geometry": JSON.parse(data[i].geo),
                "properties": {
                    "osm_id": data[i].osm_id,
                    "name": data[i].name,
                    "area": data[i].area,
                    "monuments": data[i].monuments,
                    "castles": data[i].castles,
                    "ruins": data[i].ruins,
                    "memorials": data[i].memorials,
                    "museums": data[i].museums,
                    "galleries": data[i].galleries,
                    "neighbors": data[i].neighbors,
                    "neighbor_area": data[i].neighbor_area,
                    "neighbor_monuments": data[i].neighbor_monuments,
                    "neighbor_castles": data[i].neighbor_castles,
                    "neighbor_ruins": data[i].neighbor_ruins,
                    "neighbor_memorials": data[i].neighbor_memorials,
                    "neighbor_museums": data[i].neighbor_museums,
                    "neighbor_galleries": data[i].neighbor_galleries
                }
            });
        }
        res.json(features);
    })
    .catch(function (error) {
        console.log('ERROR:', error);
    })
})

app.post('/api/get-local-attractions', jsonParser, async function(req, res) {
    var region_osm_id = req.body.osm_id;
    db.many("\
        WITH district AS\
        (\
            SELECT\
            way\
            FROM\
            planet_osm_polygon\
            WHERE\
            osm_id = $1\
        )\
        \
        SELECT\
            ST_AsGeoJSON(ST_Transform(way, 4326)) AS geo,\
            name,\
            COALESCE(historic, tourism) AS type,\
            osm_id\
        FROM\
            planet_osm_point\
        WHERE\
            (historic IN ('monument', 'castle', 'ruins', 'memorial')\
            OR tourism IN ('museum', 'gallery'))\
            AND ST_Within(way, (SELECT way FROM district))\
    ", region_osm_id)
    .then(function (data) {
        features = [];
        for(var i=0; i<data.length; i++) {
            var icon;

            switch(data[i].type) {
                case 'museum':
                    icon = 'museum';
                    break;
                case 'gallery':
                    icon = 'art-gallery';
                    break;
                case 'monument':
                    icon = 'monument';
                    break;
                case 'memorial':
                    icon = 'monument';
                    break;
                default:
                    icon = 'castle';
            }

            features.push({
                "type": "Feature",
                "geometry": JSON.parse(data[i].geo),
                "properties": {
                    "name": data[i].name,
                    "type": data[i].type,
                    "icon": icon,
                    "osm_id": data[i].osm_id
                }
            });
        }
        res.json(features);
    })
    .catch(function (error) {
        console.log('ERROR:', error);
    })
})

app.post('/api/get-nearby-hotels', jsonParser, async function(req, res) {

    var attraction_osm_id = req.body.osm_id;
    var distance_hotel_attraction = req.body.distance_hotel_attraction;
    var distance_hotel_road = req.body.distance_hotel_road;

    console.log(attraction_osm_id);
    console.log(distance_hotel_attraction);
    console.log(distance_hotel_road);

    db.many("\
        WITH attraction AS\
        (\
            SELECT\
                way\
            FROM\
                planet_osm_point\
            WHERE\
                osm_id = $1\
        )\
        \
        SELECT\
            ST_AsGeoJSON(ST_Transform(hotel.way, 4326)) AS geo,\
            name,\
            tourism,\
            ROUND(MIN(ST_Distance(hotel.way, noise_source.way))) AS distance_to_noise\
        FROM\
        (\
            SELECT\
                way,\
                name,\
                tourism\
            FROM\
                planet_osm_point\
            WHERE\
                tourism IN ('hotel', 'motel', 'guest_house')\
                AND ST_DWithin(way, (SELECT way FROM attraction), $2)\
        ) hotel\
        LEFT JOIN\
        (\
            SELECT\
                way\
            FROM\
                planet_osm_line\
            WHERE\
                name LIKE 'D_'\
                OR name LIKE 'R_'\
                OR railway IN ('rail', 'tram')\
        ) noise_source\
        ON\
            ST_DWithin(hotel.way, noise_source.way, $3)\
        GROUP BY\
            1,2,3\
    ", [attraction_osm_id, distance_hotel_attraction, distance_hotel_road])
    .then(function (data) {
        features = [];
        for(var i=0; i<data.length; i++) {
            features.push({
                "type": "Feature",
                "geometry": JSON.parse(data[i].geo),
                "properties": {
                    "name": data[i].name,
                    "type": data[i].tourism,
                    "icon": "lodging",
                    "distance_to_noise": data[i].distance_to_noise
                }
            });
        }
        res.json(features);
    })
    .catch(function (error) {
        console.log('ERROR:', error);
        res.json(null);
    })
})

// ---

// init server

app.get('/', async function(req, res) {
    res.sendFile(VIEW_PATH);
});

app.listen(port, () => console.log(`App listening on port ${port}!`))