const express = require('express')
const fs = require('fs')

const app = express()

app.use( express.static( "public" ) );
//library to upload images
const multer = require('multer')

//Import google api module
const {google} = require('googleapis')

//Import credentials
const OAuth2InData = require('./credentials.json')

//initialize OAuth parameters
const CLIENT_ID = OAuth2InData.web.client_id
const CLIENT_SECRET = OAuth2InData.web.client_secret
const REDIRECT_URI = OAuth2InData.web.redirect_uris[0]

//Retrieving resources
var name, pic

//object with parameters
const oauth2_client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
)
//create a variable for authentication
var authenticate = false //user is not authenticated

//multer upload method - middleware function
var Storage = multer.diskStorage({
    destination: function (req, file, callback) {
      callback(null, "./images");
    },
    filename: function (req, file, callback) {
      callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
    },
  });
  
  var upload = multer({
    storage: Storage,
  }).single("file"); //Field name and max count


//assign SCOPES
const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile"

app.set("view engine", "ejs")

//simple route to render index file
app.get('/',(req,res) => {
    if(!authenticate){

        var url = oauth2_client.generateAuthUrl({
            access_type:'offline',
            scope:SCOPES
        })
        console.log(url)
        //render the url
        res.render("index",{url:url})
    }else{
        var oauth2 = google.oauth2({
            auth:oauth2_client,
            version:'v2'
        })
        //get the User info
        oauth2.userinfo.get(function(err,response){
            if(err) throw err

            console.log(response.data)

            name = response.data.name
            pic = response.data.picture

            res.render("success",{name:name,pic:pic,success:false})
        })
    }

})

//handle the route for callback url
app.get('/google/callback', (req,res) => {
    const code = req.query.code

    if(code){
        //get the access token
        oauth2_client.getToken(code,function(err,token){
            if(err){
                console.log("Authentication Error")
                console.log(err)
            }else{
                console.log("Authenticated Sucessfully")
                console.log(token)
                oauth2_client.setCredentials(token)

                authenticate = true

                res.redirect('/')
            }
        })
    }    
})

//POST request to upload the pictures
app.post('/upload', (req,res) => {
    upload(req,res,function(err) {
        if(err) throw err
        console.log(req.file.path)

        //call drive API
        const drive = google.drive({
            version:'v3',
            auth:oauth2_client
        })

        const file_meta_data = {
            name:req.file.filename
        }

        const media = {
            mimeType:req.file.mimetype,
            body:fs.createReadStream(req.file.path)
        }

        //upload the file
        drive.files.create({
            resource:file_meta_data,
            media:media,
            fields:"id"
        },(err,file) => {
            if(err) throw err

            //delete local file from images folder
            fs.unlinkSync(req.file.path)
            res.render("success",{name:name,pic:pic,success:true})
        })
    })
})

//loggout
app.get('/logout',(req,res) => {
    authenticate = false
    res.redirect('/')
})

//start server on port 5000
app.listen(5000, () => {
    console.log("Application is started on port 5000")
})