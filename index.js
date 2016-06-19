var config = require('./config');
var log = require('log')(config.log);
var express = require('express');
var compression = require('compression');
var bodyParser = require('body-parser');
var async = require('async');

var app = express();

var knex = require('knex')({
    client: 'mysql',
    connection: config.db,
    debug: true
});

app.locals.db = knex;

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    if ('OPTIONS' === req.method || '/health_check' === req.path) {
	res.sendStatus(200);
    } else {
	next();
    }
});

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api', require('./routes'));

var port = config.port || process.env.PORT || 8080;

app.listen(port, function() {
    log.info('API listening on port:', port);
}).on('error', function(err) {
    log.error(err);
});
