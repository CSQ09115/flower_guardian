"""
商品种子数据脚本
用法: python -m app.db.seed_products
"""
from sqlalchemy.orm import Session

# 商品数据
PRODUCTS = [
    {
        "name": "陶瓷北欧风花盆",
        "description": "简约北欧风格陶瓷花盆，适合多肉植物和小型绿植。尺寸：直径12cm，高10cm",
        "price": 29.90,
        "stock": 100,
        "image_url": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400",
        "status": "active"
    },
    {
        "name": "自动浇水花盆",
        "description": "智能自动浇水花盆，适合新手养花。透明设计方便观察水位",
        "price": 49.90,
        "stock": 50,
        "image_url": "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400",
        "status": "active"
    },
    {
        "name": "有机花肥500g",
        "description": "纯有机植物肥料，适用于花卉、蔬菜、果树。氮磷钾均衡配比",
        "price": 19.90,
        "stock": 200,
        "image_url": "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=400",
        "status": "active"
    },
    {
        "name": "条纹十二卷多肉盆栽",
        "description": "薄荷绿陶瓷盆栽条纹十二卷，耐旱好养，适合办公桌、窗台点缀",
        "price": 45.00,
        "stock": 60,
        "image_url": "/static/products/succulent-pot.jpg",
        "status": "active"
    },
    {
        "name": "仙人掌盆栽（红陶盆）",
        "description": "经典红陶盆栽仙人掌，几乎不用打理，适合新手和忙碌人群",
        "price": 28.00,
        "stock": 80,
        "image_url": "/static/products/cactus-pot.jpg",
        "status": "active"
    },
    {
        "name": "斑纹芦荟盆栽（水泥盆）",
        "description": "斑纹芦荟配素色水泥盆，净化空气，叶汁还可用于轻微烫伤护理",
        "price": 39.00,
        "stock": 50,
        "image_url": "/static/products/aloe-pot.jpg",
        "status": "active"
    },
    {
        "name": "白掌盆栽（一帆风顺）",
        "description": "自带乳白色佛焰苞花朵，耐阴好养，适合客厅、卧室半阴环境",
        "price": 52.00,
        "stock": 35,
        "image_url": "/static/products/peace-lily.jpg",
        "status": "active"
    },
    {
        "name": "真柏盆景",
        "description": "造型真柏盆景，枝叶茂密四季常青，适合书房、玄关摆件，附赠养护手册",
        "price": 128.00,
        "stock": 12,
        "image_url": "/static/products/bonsai.jpg",
        "status": "active"
    },
    {
        "name": "多肉营养土+园艺铲套装",
        "description": "颗粒营养土搭配加大铲土器，透气保水，换盆上土一步到位",
        "price": 25.90,
        "stock": 100,
        "image_url": "/static/products/soil-shovel-set.jpg",
        "status": "active"
    },
    {
        "name": "多肉专用营养土",
        "description": "透气性好，适合多肉植物、仙人掌等肉质植物。5斤装",
        "price": 15.90,
        "stock": 150,
        "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
        "status": "active"
    },
    {
        "name": "园艺工具套装",
        "description": "包含小铲子、耙子、剪刀三件套，适合家庭园艺使用",
        "price": 39.90,
        "stock": 80,
        "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
        "status": "active"
    },
    {
        "name": "室内绿萝盆栽",
        "description": "净化空气首选，易于养护。适合放在客厅、卧室",
        "price": 35.00,
        "stock": 30,
        "image_url": "https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?w=400",
        "status": "active"
    },
    {
        "name": "君子兰盆栽",
        "description": "高雅花卉，叶片厚实，花开艳丽。适合客厅摆放",
        "price": 68.00,
        "stock": 20,
        "image_url": "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400",
        "status": "active"
    },
    {
        "name": "小型喷雾壶",
        "description": "植物浇水喷雾壶，300ml容量，雾化效果好",
        "price": 12.90,
        "stock": 120,
        "image_url": "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400",
        "status": "active"
    },
    {
        "name": "吊兰盆栽",
        "description": "垂挂式绿植，适合阳台、书房。净化空气效果好",
        "price": 25.00,
        "stock": 40,
        "image_url": "https://images.unsplash.com/photo-1593691509543-c55fb32d8de5?w=400",
        "status": "active"
    },
    {
        "name": "发财树盆栽",
        "description": "寓意好，适合办公室、店铺摆放。招财进宝",
        "price": 88.00,
        "stock": 15,
        "image_url": "https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=400",
        "status": "active"
    },
    {
        "name": "防潮收纳箱",
        "description": "园艺工具收纳箱，防潮防尘，大容量设计",
        "price": 34.90,
        "stock": 60,
        "image_url": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
        "status": "active"
    },
    {
        "name": "绿萝专用肥",
        "description": "绿萝、吊兰等藤本植物专用液态肥，效果显著",
        "price": 22.90,
        "stock": 90,
        "image_url": "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=400",
        "status": "active"
    }
]


def seed_products(db: Session):
    """按名称补插缺失商品（已有商品保持不动，避免重复插入）"""
    from app.models.product import Product

    existing_names = {name for (name,) in db.query(Product.name).all()}
    inserted = 0
    for p in PRODUCTS:
        if p["name"] in existing_names:
            continue
        product = Product(
            name=p["name"],
            description=p["description"],
            price=p["price"],
            stock=p["stock"],
            image_url=p["image_url"],
            status=p["status"]
        )
        db.add(product)
        inserted += 1

    db.commit()
    print(f"成功插入 {inserted} 个商品（已有 {len(existing_names)} 个跳过）")


if __name__ == "__main__":
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        seed_products(db)
    finally:
        db.close()
