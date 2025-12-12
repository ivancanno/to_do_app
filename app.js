const express = require("express");
const path = require("path");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");

// Conexión a MongoDB
require("./db"); // importa la conexión

const app = express();

// ===============================
// Configuración básica
// ===============================
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// Esquemas y modelos
// ===============================
const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  title: String,
  description: String,
  deadline: Date,
  estimatedDuration: Number,
  priority: Number
});

const listSchema = new mongoose.Schema({
  name: String,
  items: [itemSchema]
});

const List = mongoose.model("List", listSchema);

// ===============================
// Funciones de ordenación
// ===============================
function sortByImportance(list) {
  list.sort((a, b) => a.priority - b.priority);
}

function sortByDeadline(list) {
  list.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });
}

// ===============================
// Rutas
// ===============================
app.get("/", async (req, res) => {
  const sortBy = req.query.sortBy;
  try {
    let generalList = await List.findOne({ name: "general" }) || await List.create({ name: "general", items: [] });
    let workList = await List.findOne({ name: "work" }) || await List.create({ name: "work", items: [] });

    const generalTasks = [...generalList.items];
    const workTasks = [...workList.items];

    if (sortBy === "importance") {
      sortByImportance(generalTasks);
      sortByImportance(workTasks);
    } else if (sortBy === "deadline") {
      sortByDeadline(generalTasks);
      sortByDeadline(workTasks);
    }

    res.render("index", { generalTasks, workTasks, sortBy: sortBy || "" });
  } catch (err) {
    console.error("Error al cargar tareas:", err);
    res.status(500).send("Error al cargar tareas");
  }
});

app.post(
  "/add",
  [
    body("title").trim().escape(),
    body("description").trim().escape(),
    body("list").trim().isIn(["general", "work"]),
    body("deadline").optional({ checkFalsy: true }).trim().escape(),
    body("estimatedDuration").optional({ checkFalsy: true }).toInt(),
    body("priority").toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).send("Datos inválidos");

    let { title, description, list, deadline, estimatedDuration, priority } = req.body;
    const newItem = {
      title,
      description,
      deadline: deadline || null,
      estimatedDuration: estimatedDuration >= 0 ? estimatedDuration : null,
      priority
    };

    try {
      let targetList = await List.findOne({ name: list }) || await List.create({ name: list, items: [] });
      targetList.items.push(newItem);
      await targetList.save();
      res.redirect("/?sortBy=" + (req.query.sortBy || ""));
    } catch (err) {
      console.error("Error al guardar tarea:", err);
      res.status(500).send("Error al guardar tarea");
    }
  }
);

app.post("/delete", async (req, res) => {
  const { id, list } = req.body;
  try {
    await List.findOneAndUpdate({ name: list }, { $pull: { items: { _id: id } } });
    res.redirect("/?sortBy=" + (req.query.sortBy || ""));
  } catch (err) {
    console.error("Error al eliminar tarea:", err);
    res.status(500).send("Error al eliminar tarea");
  }
});

// ===============================
// Iniciar servidor
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

module.exports = app;
