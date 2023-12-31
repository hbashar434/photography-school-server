const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

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
      return res.status(403).send({ error: true, message: "forbidden access" });
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
    const paymentCollection = client
      .db("photographySchoolDB")
      .collection("payments");

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
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // verify Instructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
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

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ student: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role === "student" };
      res.send(result);
    });

    app.patch("/users/role", async (req, res) => {
      const email = req.query?.email;
      const role = req.query?.role;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //classes routes
    app.get("/classes", async (req, res) => {
      const query = req.query?.limit;
      const approvedClasses = req.query?.approved;
      const filter = { status: "approved" };
      if (query) {
        const result = await classCollection
          .find(filter)
          .sort({ enrolled: -1 })
          .limit(parseInt(query))
          .toArray();
        res.send(result);
        return;
      }

      if (approvedClasses) {
        const result = await classCollection
          .find(filter)
          .sort({ date: -1 })
          .toArray();
        res.send(result);
        return;
      }

      const result = await classCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    // get classes by id
    app.get("/updateclass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    });

    //instructor post
    app.post("/classes", verifyJWT, async (req, res) => {
      const course = req.body;
      const result = await classCollection.insertOne(course);
      res.send(result);
    });

    //update class by id
    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const course = req.body;
      const updateDoc = {
        $set: {
          ...course,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //update status by admin
    app.patch("/classstatus/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.query?.status;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //send feedback by admin
    app.put("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const { feedback } = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          feedback,
        },
      };
      const result = await classCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //instructor class get
    app.get("/myclasses", verifyJWT, async (req, res) => {
      const email = req.query?.email;
      const query = { instructorEmail: email };
      const result = await classCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    //instructors route
    app.get("/instructors", async (req, res) => {
      const query = req.query?.limit;
      if (query) {
        const result = await userCollection
          .find()
          .limit(parseInt(query))
          .toArray();
        res.send(result);
        return;
      }
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //my classlist route
    app.get("/classlist", verifyJWT, async (req, res) => {
      const email = req.query?.email;
      const query = { studentEmail: email };
      const result = await classlistCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/myclasslist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classlistCollection.findOne(query);
      res.send(result);
    });

    //post routes add class in list
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

    //enroll classes route
    app.get("/enrolled", verifyJWT, async (req, res) => {
      const email = req.query?.email;
      const query = { paymentEmail: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const query = { _id: new ObjectId(payment.enrolledId) };
      const filter = { _id: new ObjectId(payment.classId) };
      const classInfo = await classCollection.findOne(filter);

      if (classInfo.availableSeats <= 0) {
        res.status(400).send({ error: "No available seats" });
        return;
      }

      const insertResult = await paymentCollection.insertOne(payment);

      const updateResult = await classCollection.updateOne(filter, {
        $inc: { availableSeats: -1, enrolled: 1 },
      });

      const deleteResult = await classlistCollection.deleteOne(query);

      res.send({ insertResult, updateResult, deleteResult });
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
