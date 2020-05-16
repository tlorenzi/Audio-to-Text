const express = require("express");
const SpeechToTextV1 = require("ibm-watson/speech-to-text/v1");
const fs = require("fs");
const { IamAuthenticator } = require("ibm-watson/auth");
const path = require("path");
const session = require("express-session");
const crypto = require("crypto");
const MongoClient = require("mongodb").MongoClient;
const app = express();
const FileType = require('file-type');


// !!! swap session with JWT

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Our app is running on port ${PORT}`);
});

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "shhhhhh-its-secrete",
    resave: false,
    saveUninitialized: true,
  })
);

const url = "Connection string for mongoDB would go here";
let collection;


MongoClient.connect(url, function (err, client) {
  if (err) {
    console.log("error connecting to db");
    return;
  }
  console.log("Connected successfully to db");
  collection = client.db("data").collection("authenticate");
});


const speechToText = new SpeechToTextV1({
  authenticator: new IamAuthenticator({
    apikey: "",
  }),
  url:
    "https://api.us-south.speech-to-text.watson.cloud.ibm.com/instances/a9bf62fc-e6a9-45ec-be39-4e4d3398301e",
});

const params = {
  objectMode: false,
  contentType: "audio/flac", // !!!!!!!! allow all values
  model: "en-US_BroadbandModel",
};

app.get("/", (req, res) => {
  res.sendFile(__dirname + '/landingpage.html');
});

app.get("/loginPage", (req, res) => {
  res.sendFile(__dirname + '/loginpage.html');
});

app.post("/signin", (req, res) => {
  const sha = crypto.createHash("sha1");
  const hashcode = sha.update(req.body.name).digest("hex");

  collection.find({ email: hashcode, password: req.body.password }).toArray()
    .then(result => {
      if (result.length === 1) {
        req.session.email = req.body.name;
        res.send("yes");
      }
      else {
        res.send("no");
      }
    })
    .catch(err => res.send("no"));
});

app.post("/signUp", (req, res) => {
  const sha = crypto.createHash("sha1");
  const hashcode = sha.update(req.body.name).digest("hex");

  collection.find({ email: hashcode, password: req.body.password }).toArray()
    .then(result => {
      if (result.length === 1) {
        req.session.email = req.body.name;
        res.send("no");
      }
      else {
        collection.insertOne({ email: hashcode, password: req.body.password }).then(() => {

          fs.mkdirSync("./users/" + req.body.name);
          req.session.email = req.body.name;
          res.send("yes");
        })
          .catch(err => res.send("no"))
      }
    })
    .catch(err => res.send("no"));
});

app.get("/userpage", (req, res) => {
  res.sendFile(__dirname + '/userpage.html');
});

app.get("/files", (req, res) => {
  if (req.session.email == undefined) res.send("error"); //res.redirect("/loginPage");

  const folderPath = __dirname + "/users/" + req.session.email;  // !!! maybe

  fs.readdir(folderPath, (error, results) => {

    const files = results;
    if (error) console.log(error.message);
    else {
      res.send({ fileList: files, email: req.session.email });
    }
  });
});

app.post("/work", (req, res) => {

  const filename = req.body.fileName;
  const recognizeStream = speechToText.recognizeUsingWebSocket(params);

  let obj = (async () => {
    await FileType.fromFile(req.body.fileName);
    //=> {ext: 'png', mime: 'image/png'}
  })();
  params.contentType = obj.mime;

  fs.createReadStream(filename).pipe(recognizeStream);
  recognizeStream.pipe(
    fs.createWriteStream(
      __dirname + "/users/" +
      req.session.email +
      "/" +
      filename +
      ".txt"
    )
  );
  recognizeStream.setEncoding("utf8");
  res.redirect('/userpage');
});

app.get("*", (req, res) => {
  res.sendFile(__dirname + req.url);
});
