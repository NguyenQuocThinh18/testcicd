const chai = require("chai");
const chaiHttp = require("chai-http");
const jwt = require("jsonwebtoken");
const App = require("../app");
const { expect } = chai;

chai.use(chaiHttp);

describe("Products", () => {
  let app;
  let authToken;

  before(async function () {
    this.timeout(30000);
    app = new App();
    await Promise.all([app.connectDB(), app.setupMessageBroker()]);
    await app.start(3001);

    // Mock JWT token
    authToken = jwt.sign(
      { username: "testuser", role: "user" },
      process.env.JWT_SECRET || "testsecret",
      { expiresIn: "1h" }
    );
  });

  after(async () => {
    await app.disconnectDB();
    await app.stop();
  });

  describe("POST /", () => {
    it("should create a new product", async () => {
      const product = {
        name: "Product 1",
        description: "Description of Product 1",
        price: 10,
      };

      const res = await chai
        .request(app.app)
        .post("/") // ✅ sửa lại đúng route
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("name", product.name);
      expect(res.body).to.have.property("description", product.description);
      expect(res.body).to.have.property("price", product.price);
    });

    it("should return an error if name is missing", async () => {
      const product = { description: "No name", price: 10.99 };

      const res = await chai
        .request(app.app)
        .post("/") // ✅ sửa lại đúng route
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(400);
    });
  });
});