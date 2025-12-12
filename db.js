const mongoose = require("mongoose");
if (process.env.NODE_ENV !== "production") require("dotenv").config();

const { MONGO_USER, MONGO_PASS, MONGO_CLUSTER, MONGO_DB } = process.env;

if (!MONGO_USER || !MONGO_PASS || !MONGO_CLUSTER || !MONGO_DB) {
  console.error("❌ Falta alguna variable de entorno de MongoDB");
  process.exit(1);
}

const mongoURI = `mongodb+srv://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASS)}@${MONGO_CLUSTER}/${MONGO_DB}?retryWrites=true&w=majority`;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => { console.error("❌ Error conectando a MongoDB:", err); process.exit(1); });

module.exports = mongoose;
