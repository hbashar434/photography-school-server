const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
    const userCollection = client.db("photographySchoolDB").collection("users");
    const classCollection = client
      .db("photographySchoolDB")
      .collection("classes");
    const instructorCollection = client
      .db("photographySchoolDB")
      .collection("instructors");
    const classlistCollection = client
      .db("photographySchoolDB")
      .collection("classlist");

    //generate jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // user route
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const exitingUser = await userCollection.findOne(query);
      if (exitingUser) {
        return res.send({ message: "user already exit" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
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
      const query = req.query?.limit;
      if (query) {
        const result = await instructorCollection
          .find()
          .limit(parseInt(query))
          .toArray();
        res.send(result);
        return;
      }
      const result = await instructorCollection.find().toArray();
      res.send(result);
    });
    //my classlist route
    app.get("/classlist", verifyJWT, async (req, res) => {
      const email = req.query?.email;
      const query = { studentEmail: email };
      const result = await classlistCollection.find(query).toArray();
      res.send(result);
    });

    //post routes
    app.post("/classlist", async (req, res) => {
      const course = req.body;
      const result = await classlistCollection.insertOne(course);
      res.send(result);
    });

    //delete route
    app.delete("/classlist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classlistCollection.deleteOne(query);
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
