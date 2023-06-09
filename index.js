const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();

const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

// verifyJWT middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uprfadf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    client.connect();
    ///////////////////////////////////////////////////////////////////////
    const classCollection = client
      .db("photographySchoolDB")
      .collection("classes");
    const instructorCollection = client
      .db("photographySchoolDB")
      .collection("instructors");

    //generate jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //classes routes
    app.get("/classes", async (req, res) => {
      const query = req.query?.limit;
      if (query) {
        const result = await classCollection
          .find()
          .sort({ enroll: -1 })
          .limit(parseInt(query))
          .toArray();
        res.send(result);
        return;
      }
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    //instructors route
    app.get("/instructors", async (req, res) => {
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });

    ///////////////////////////////////////////////////////////////////////
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("The Photography School server is running");
});

app.listen(port, () => {
  console.log(`The server listening on port ${port}`);
});
