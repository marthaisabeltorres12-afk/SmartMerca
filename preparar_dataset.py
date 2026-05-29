import os, shutil, random

BASE = r"C:\xampp\htdocs\smartmerca\backend\ia_models\smartmerca-frutas.v1i.yolov8"

train_img = os.path.join(BASE, "train", "images")
train_lbl = os.path.join(BASE, "train", "labels")
valid_img = os.path.join(BASE, "valid", "images")
valid_lbl = os.path.join(BASE, "valid", "labels")
test_img  = os.path.join(BASE, "test",  "images")
test_lbl  = os.path.join(BASE, "test",  "labels")

# Crear carpetas
for p in [valid_img, valid_lbl, test_img, test_lbl]:
    os.makedirs(p, exist_ok=True)

# Listar fotos del train
fotos = [f for f in os.listdir(train_img) if f.endswith(('.jpg','.jpeg','.png'))]
random.shuffle(fotos)

# Tomar 15% para valid y 5% para test
n_valid = max(3, int(len(fotos) * 0.15))
n_test  = max(2, int(len(fotos) * 0.05))

valid_fotos = fotos[:n_valid]
test_fotos  = fotos[n_valid:n_valid + n_test]

def copiar(fotos, src_img, src_lbl, dst_img, dst_lbl):
    for foto in fotos:
        nombre = os.path.splitext(foto)[0]
        # Copiar imagen
        shutil.copy(os.path.join(src_img, foto), os.path.join(dst_img, foto))
        # Copiar label si existe
        lbl = nombre + ".txt"
        if os.path.exists(os.path.join(src_lbl, lbl)):
            shutil.copy(os.path.join(src_lbl, lbl), os.path.join(dst_lbl, lbl))

copiar(valid_fotos, train_img, train_lbl, valid_img, valid_lbl)
copiar(test_fotos,  train_img, train_lbl, test_img,  test_lbl)

print(f"✅ Dataset preparado:")
print(f"   Train:  {len(fotos)} fotos")
print(f"   Valid:  {len(valid_fotos)} fotos")
print(f"   Test:   {len(test_fotos)} fotos")
print(f"\nAhora ejecute: python entrenar_modelo.py")