import { useState } from "react";
import { Field } from "../../shared/components/Field";
import { Modal } from "../../shared/components/Modal";
import type { Plant, Product } from "../data/types";

export type ProductFormValue = {
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  plant_id: number | null;
  status: "active" | "inactive";
};

type ProductFormProps = {
  open: boolean;
  product: Product | null;
  plants: Plant[];
  onClose: () => void;
  onSave: (value: ProductFormValue) => Promise<void>;
  onError: (message: string) => void;
};

/**
 * Create / edit dialog for a product. Ported from `openForm()` in
 * `legacy/admin/assets/js/views/products.js`, including the validation wording.
 */
export function ProductForm({
  open,
  product,
  plants,
  onClose,
  onSave,
  onError,
}: ProductFormProps): JSX.Element {
  const editing = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price === undefined ? "" : String(product.price));
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [plantId, setPlantId] = useState(product?.plant_id ? String(product.plant_id) : "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(product?.status ?? "active");

  const submit = async (): Promise<void> => {
    const trimmedName = name.trim();
    const numericPrice = Number(price);
    if (!trimmedName) {
      onError("请填写商品名称");
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      onError("价格需为不小于 0 的数字");
      return;
    }
    await onSave({
      name: trimmedName,
      price: numericPrice,
      stock: Number(stock || 0),
      image_url: imageUrl.trim() || null,
      plant_id: plantId ? Number(plantId) : null,
      status,
      description: description.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      title={editing ? "编辑商品" : "新建商品"}
      subtitle={editing ? `${product?.name} · #${product?.id}` : "创建后会出现在商城列表。"}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn" type="button" onClick={() => void submit()}>
            {editing ? "保存修改" : "创建商品"}
          </button>
        </>
      }
    >
      <form id="p-form" style={{ display: "grid", gap: "12px" }} onSubmit={(event) => event.preventDefault()}>
        <div className="form-row">
          <Field label="商品名称" name="name" value={name} onChange={setName} placeholder="如：绿萝水培套装" />
          <Field
            label="价格（元）"
            name="price"
            type="number"
            value={price}
            onChange={setPrice}
            min={0}
            step={0.01}
            placeholder="35.00"
          />
        </div>
        <div className="form-row">
          <Field label="库存" name="stock" type="number" value={stock} onChange={setStock} min={0} step={1} />
          <div className="field">
            <label htmlFor="f-plant_id">关联植物</label>
            <select
              className="select"
              id="f-plant_id"
              name="plant_id"
              style={{ width: "100%" }}
              value={plantId}
              onChange={(event) => setPlantId(event.target.value)}
            >
              <option value="">不关联</option>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Field
          label="图片地址"
          name="image_url"
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="https://… 或 ../assets/xxx.jpg"
          hint="留空时用商品名称首字生成占位缩略图。"
        />
        <div className="field">
          <label htmlFor="f-description">商品描述</label>
          <textarea
            className="input"
            id="f-description"
            name="description"
            rows={3}
            style={{ height: "auto", padding: "9px 12px", resize: "vertical" }}
            placeholder="一句话说明包含什么、适合谁"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="f-status">状态</label>
          <select
            className="select"
            id="f-status"
            name="status"
            style={{ width: "100%" }}
            value={status}
            onChange={(event) => setStatus(event.target.value as "active" | "inactive")}
          >
            <option value="active">在售</option>
            <option value="inactive">已下架</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
