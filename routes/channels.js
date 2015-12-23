/* global module, require */

var express = require('express'),
    utils = require('../utils'),
    router = express.Router();

router.post('/', utils.hasParams(['name']), function(req, res) {

    var name = req.query.name;

    req.app.locals.db('channels').select().where('name', name).then(function(channel) {

	if (channel.length) {
	    res.status(200).send(channel[0]);
	    return;
	}

	req.app.locals.db('channels').insert({
	    name: name,
	    created_at: new Date(),
	    updated_at: new Date()
	}).then(function(channel) {
	    res.status(200).send(channel);
	}).catch(function(err) {
	    res.status(500).send({ error: err });
	});

    }).catch(function(err) {
	res.status(500).send({ error: err });
    });
});

router.use('/:channel', require('./channel'));

module.exports = router;
