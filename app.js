const express = require("express");
const path = require("path");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

// ===============================
// 1) Configuración básica
// ===============================
const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI;

// Para depurar que la URI existe
console.log("MONGODB_ATLAS_URI:", MONGODB_ATLAS_URI ? "OK" : "NO DEFINIDA");

// Seguridad básica + CSP simple
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

// Motor de vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.urlencoded({ extended: true })); // para leer req.body de formularios
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// 2) Conexión a MongoDB Atlas
// ===============================
mongoose
  .connect(MONGODB_ATLAS_URI)
  .then(() => console.log("Conectado a MongoDB Atlas"))
  .catch((err) => {
    console.error("Error de conexión a MongoDB Atlas:", err);
  });

// ===============================
// 3) Esquemas y modelos
// ===============================
const itemSchema = new mongoose.Schema({
  title: String,
  description: String,
  deadline: Date,           // puede ser null
  estimatedDuration: Number,
  priority: Number
});

const listSchema = new mongoose.Schema({
  name: String,             // "general" o "work"
  items: [itemSchema]
});

const List = mongoose.model("List", listSchema);

// ===============================
// 4) Funciones de ordenación
// ===============================
function sortByImportance(list) {
  list.sort((a, b) => a.priority - b.priority);
}

function sortByDeadline(list) {
  list.sort((a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;    // sin fecha -> al final
    if (!b.deadline) return -1;
    const da = new Date(a.deadline);
    const db = new Date(b.deadline);
    return da - db;
  });
}

// ===============================
// 5) Ruta principal: mostrar tareas
// ===============================
app.get("/", async (req, res) => {
  const sortBy = req.query.sortBy; // "importance" o "deadline"

  try {
    // Buscar o crear listas "general" y "work"
    let generalList = await List.findOne({ name: "general" });
    if (!generalList) {
      generalList = await List.create({ name: "general", items: [] });
    }

    let workList = await List.findOne({ name: "work" });
    if (!workList) {
      workList = await List.create({ name: "work", items: [] });
    }

    const generalTasks = [...generalList.items];
    const workTasks = [...workList.items];

    if (sortBy === "importance") {
      sortByImportance(generalTasks);
      sortByImportance(workTasks);
    } else if (sortBy === "deadline") {
      sortByDeadline(generalTasks);
      sortByDeadline(workTasks);
    }

    res.render("index", {
      generalTasks,
      workTasks,
      sortBy: sortBy || ""
    });
  } catch (err) {
    console.error("Error al cargar tareas:", err);
    res.status(500).send("Error al cargar tareas");
  }
});

// ===============================
// 6) Crear tarea
// ===============================
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
    if (!errors.isEmpty()) {
      console.log("Errores de validación:", errors.array());
      return res.status(400).send("Datos inválidos");
    }

    let {
      title,
      description,
      list,
      deadline,
      estimatedDuration,
      priority
    } = req.body;

    // Debug: ver lo que llega del formulario
    console.log("POST /add body:", req.body);

    if (!deadline) {
      deadline = null;
    }

    if (!estimatedDuration || estimatedDuration < 0) {
      estimatedDuration = null;
    }

    const newItem = {
      title,
      description,
      deadline,
      estimatedDuration,
      priority
    };

    try {
      let targetList = await List.findOne({ name: list });
      if (!targetList) {
        targetList = await List.create({ name: list, items: [] });
      }

      targetList.items.push(newItem);
      await targetList.save();

      res.redirect("/?sortBy=" + (req.query.sortBy || ""));
    } catch (err) {
      console.error("Error al guardar tarea:", err);
      res.status(500).send("Error al guardar tarea");
    }
  }
);

// ===============================
// 7) Eliminar tarea
// ===============================
app.post("/delete", async (req, res) => {
  const itemId = req.body.id;
  const list = req.body.list;

  console.log("POST /delete body:", req.body);

  try {
    await List.findOneAndUpdate(
      { name: list },
      { $pull: { items: { _id: itemId } } }
    );

    res.redirect("/?sortBy=" + (req.query.sortBy || ""));
  } catch (err) {
    console.error("Error al eliminar tarea:", err);
    res.status(500).send("Error al eliminar tarea");
  }
});

// ===============================
// 8) Arrancar servidor
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor escuchando en el puerto", PORT);
});

module.exports = app;
