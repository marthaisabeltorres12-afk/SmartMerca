from ultralytics import YOLO

# Ruta del dataset descargado de Roboflow
DATASET = r"C:\xampp\htdocs\smartmerca\backend\ia_models\smartmerca-frutas.v1i.yolov8\data.yaml"

# Cargar modelo base YOLOv8 nano (el más ligero, ideal para PC sin GPU)
model = YOLO('yolov8n.pt')

# Entrenar
results = model.train(
    data    = DATASET,
    epochs  = 50,        # 50 pasadas por las fotos
    imgsz   = 640,       # tamaño de imagen
    batch   = 8,         # fotos por lote (reducir a 4 si hay error de memoria)
    name    = 'smartmerca-frutas',
    project = r'C:\xampp\htdocs\smartmerca\backend\ia_models',
    patience= 10,        # para si no mejora en 10 epochs
    device  = 'cpu',     # usar CPU (sin GPU)
    workers = 2,
)

print("\n✅ Entrenamiento completado!")
print(f"Modelo guardado en: {results.save_dir}")
print(f"Mejor modelo: {results.save_dir}\\weights\\best.pt")