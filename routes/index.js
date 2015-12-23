/* global module, require */

var express = require('express'),
    router = express.Router();

router.use('/sources', require('./sources'));
router.use('/channels', require('./channels'));

router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });   
});

module.exports = router;
