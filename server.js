const express = require('express');
const http = require('http');
var request = require('request');
const bodyParser = require('body-parser');
const cors = require('cors');
var jwt = require('jsonwebtoken');
var passport = require('passport');
var passportJWT = require('passport-jwt');
let ExtractJwt = passportJWT.ExtractJwt;
let JwtStrategy = passportJWT.Strategy;
let jwtOptions = {};
jwtOptions.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
jwtOptions.secretOrKey = 'wowwow';
const PORT  = 3000;

const app = express();
const mysql = require('mysql');

app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(cors());

// lets create our strategy for web token
let strategy = new JwtStrategy(jwtOptions, function(jwt_payload, next) {
    console.log('payload received', jwt_payload);
    let user = getUser({ id: jwt_payload.id });
    if (user) {
      next(null, user);
    } else {
      next(null, false);
    }
});
// use the strategy
passport.use(strategy);

var con = mysql.createConnection({
    host: "svcmp-db-server.c2qhjtdkchcl.ap-south-1.rds.amazonaws.com",
    user: "admin_save_camp",
    password: "fnABKh7O1FdzORHXVVTb",
    database: "save_camp"
});

app.get('/',function(req,res){
    res.send('this is server');
})

app.post('/checkUsername', function(req, res) {
    var input = JSON.parse(JSON.stringify(req.body));
    con.connect(function (err) {
        var today = new Date();
        var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
        var curTime = today.getTime();
        var query = con.query("SELECT `u`.`id`,`sh`.`shift_from`,`sh`.`shift_to` FROM `users` AS `u` INNER JOIN `staff` AS `s` ON `s`.`user_id` = `u`.`id` INNER JOIN `shift` AS `sh` ON `sh`.`id` = `s`.`shift` WHERE 1 AND `u`.`phone`=? AND `u`.`role_id` IN (1,2,4,5,6,8,10,11)", input.username, function (err, rows) {
            if (err) {
                res.format({
                    'application/json': function () {
                      res.send({
                        status: 'Failure',
                        'Response': 0,
                        'Error' : 'Username Incorrect'
                      })
                    }
                });
            } else {
                if(rows.length>0){
                    var curfromdate = Date.parse(date+' '+rows[0].shift_from); 
                    var curtodate = Date.parse(date+' '+rows[0].shift_to);
                    if(curTime>=curfromdate && curTime<=curtodate){
                        var data = {
                            otp: Math.floor(100000 + Math.random() * 999999)
                        }
                        var updateQuery = con.query("UPDATE `users` SET ? WHERE 1 AND `phone`=?", [data, input.username], function (err, rows) {
                            if (err) {
                                res.format({
                                'application/json': function () {
                                    res.send({
                                    status: 'Failure',
                                    'Response': 0,
                                    'Error':err
                                    })
                                }
                                });
                            } else {
                                /*var url = 'https://smsapi.24x7sms.com/api_2.0/SendSMS.aspx?APIKEY=gtNppuR7tob&MobileNo=91'+input.username+'&SenderID=SMSMsg&Message=Test SMS&ServiceName=TEMPLATE_BASED'; 
                                request(url, function (error, response, body) { 
                                    if (!error && response.statusCode == 200) { } else { console.log(body + "" + response + "" + error); callBack(error); } 
                                });*/
                                res.format({
                                    'application/json': function () {
                                        res.send({
                                        status: 'Success',
                                        'Response': 1
                                        })
                                    }
                                });
                            }
                        });
                    } else {
                        res.format({
                            'application/json': function () {
                                res.send({
                                status: 'Success',
                                'Response': 0,
                                'Error': 'Shift Time Mismatch'
                                })
                            }
                        }); 
                    }
                } else {
                    res.format({
                        'application/json': function () {
                            res.send({
                            status: 'Success',
                            'Response': 0,
                            'Error': 'Username Incorrect'
                            })
                        }
                    });  
                }
            }
        });
    });
});

app.post('/loginUser', function(req, res) {
    var input = JSON.parse(JSON.stringify(req.body));
    con.connect(function (err) {
        var query = con.query("SELECT `id`,`otp` FROM `users` WHERE 1 AND `phone`=? ", input.username, function (err, rows) {
            if (err) {
                res.format({
                    'application/json': function () {
                        res.send({
                            status: 'Failure',
                            'Error': 'Server Error',
                            'Response': 0
                        })
                    }
                });
            } else {
                if(Number(rows[0].otp)==Number(input.password)){
                    var data = {
                        otp: '',
                    }
                    var updateQuery = con.query("UPDATE `users` SET ? WHERE 1 AND `phone`=?", [data, input.username], function (err, rowss) {
                        if (err) {
                            res.format({
                                'application/json': function () {
                                    res.send({
                                        status: 'Failed',
                                        'Response': 0,
                                        'Erorr': 'Update Error'
                                    })
                                }
                            });
                        } else {
                            let payload = { id: rows[0].id };
                            let token = jwt.sign(payload, jwtOptions.secretOrKey);
                            res.format({
                                'application/json': function () {
                                    res.send({
                                        status: 'Success',
                                        token : token,
                                        'Response': 1,
                                        'Result': rows[0].id
                                    })
                                }
                            });
                        }
                    });
                } else {
                    res.format({
                        'application/json': function () {
                            res.send({
                                status: 'Failed',
                                'Response': 2,
                                'Erorr': 'Enter Correct OTP'
                            })
                        }
                    });
                }
            }
        });
    });
});

app.post('/userCheckin', function(req, res) {
    var input = JSON.parse(JSON.stringify(req.body));
    con.connect(function (err) {
        var data = {
            user : input.user,
            type : 'Checkin',
            lat  : input.lat,
            lng  : input.lng,
        } 
        var query = con.query("INSERT INTO `user_attendance` SET ?", data, function (err, rows) {
            if (err) {
                res.format({
                    'application/json': function () {
                        res.send({
                            status: 'Failed',
                            'Response': 0
                        });
                    }
                });
            } else {
                res.format({
                    'application/json': function () {
                        res.send({
                            status: 'Success',
                            'Response': 1
                        });
                    }
                });
            }
        });
    });
});

app.post('/userCheckout', function(req, res) {
    var input = JSON.parse(JSON.stringify(req.body));
    con.connect(function (err) {
        var data = {
            user : input.user,
            type : 'Checkout',
            lat  : input.lat,
            lng  : input.lng,
        } 
        var query = con.query("INSERT INTO `user_attendance` SET ?", data, function (err, rows) {
            if (err) {
                res.format({
                    'application/json': function () {
                        res.send({
                            status: 'Failed',
                            'Response': 0
                        })
                    }
                });
            } else {
                res.format({
                    'application/json': function () {
                        res.send({
                        status: 'Success',
                        'Response': 1
                        })
                    }
                });
            }
        });
    });
});

//listen 
app.listen(PORT,function(){
    console.log('server is running');
})