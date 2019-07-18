var express = require('express'),
    app = express();

app.use(express.static('client')); 
app.listen(8081, function () {
    console.log('server online listening to port 8081');
});


