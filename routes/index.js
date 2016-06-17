/* global module, require */

var express = require('express'),
    config = require('../config'),
    log = require('log')(config.log),
    router = express.Router(),
    jwt = require('jsonwebtoken');

var authenticate = function(req, res, next) {
    var token = req.param('token');
    if (token && token !== 'undefined') {
	jwt.verify(token, config.secret, function(err, decoded) {
	    if (err) log.error(err);
	    req.user = decoded;
	    next();
	});
    } else {
	next();
    }
};

router.all('/', authenticate);
router.use('/sources', require('./sources'));
router.use('/channels', require('./channels'));

router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });   
});

module.exports = router;
