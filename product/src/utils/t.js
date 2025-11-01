const amqp = require("amqplib");
const config = require("../config");

class MessageBroker {
  constructor() {
    this.channel = null;
    this.connection = null;
    this.url = process.env.RABBITMQ_URI || config.rabbitMQURI || "amqp://guest:guest@127.0.0.1:5672";
  }

  async connect(retries = 6, baseDelayMs = 1500) {
    let attempt = 0;
    while (attempt < retries) {
      try {
        attempt++;
        console.log(`RabbitMQ: connecting to ${this.url} (attempt ${attempt})`);
        const connOptions = {
          heartbeat: 60,
          timeout: 10000,
          clientProperties: { connection_name: "product-service" },
        };
        this.connection = await amqp.connect(this.url, connOptions);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(config.rabbitMQQueue || "products", { durable: true });
        await this.channel.assertQueue("orders", { durable: true });
        console.log("RabbitMQ connected on", this.url);

        this.connection.on("error", (err) => console.error("RabbitMQ connection error:", err && err.stack ? err.stack : err));
        this.connection.on("close", () => {
          console.warn("RabbitMQ connection closed, will attempt reconnect");
          setTimeout(() => this.connect(retries, baseDelayMs).catch((e) => console.error(e)), 1000);
        });

        return;
      } catch (err) {
        console.error(`Failed to connect to RabbitMQ (attempt ${attempt}):`, err && err.stack ? err.stack : err);
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
    throw new Error("Unable to connect to RabbitMQ after retries");
  }

  publish(queue, payload) {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
  }

  async consume(queue, handler) {
    if (!this.channel) throw new Error("RabbitMQ channel not initialized");
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString());
        await handler(data);
        this.channel.ack(msg);
      } catch (err) {
        console.error("Error handling message:", err);
        this.channel.nack(msg, false, false);
      }
    });
  }
}

module.exports = new MessageBroker();