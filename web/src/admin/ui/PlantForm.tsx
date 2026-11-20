import { useState } from "react";
import { Field } from "../../shared/components/Field";
import { Modal } from "../../shared/components/Modal";
import type { Plant, PlantInput } from "../data/types";

/**
 * Create / edit dialog for a plant entry. Ported from `openForm()` in
 * `legacy/admin/assets/js/views/plants.js`, including the 「请填写中文名」
 * validation and the null-for-empty payload.
 */
export function PlantForm({
  open,
  plant,
  onClose,
  onSave,
  onError,
}: {
  open: boolean;
  plant: Plant | null;
  onClose: () => void;
  onSave: (value: PlantInput) => Promise<void>;
  onError: (message: string) => void;
}): JSX.Element {
  const editing = Boolean(plant);
  const [name, setName] = useState(plant?.name ?? "");
  const [scientificName, setScientificName] = useState(plant?.scientific_name ?? "");
  const [category, setCategory] = useState(plant?.category ?? "");
  const [careLevel, setCareLevel] = useState(String(plant?.care_level ?? 1));
  const [yoloId, setYoloId] = useState(plant?.yolo_class_id == null ? "" : String(plant.yolo_class_id));
  const [light, setLight] = useState(plant?.light_requirement ?? "");
  const [water, setWater] = useState(plant?.water_requirement ?? "");
  const [temperature, setTemperature] = useState(plant?.temperature_range ?? "");
  const [humidity, setHumidity] = useState(plant?.humidity_range ?? "");
  const [imageUrl, setImageUrl] = useState(plant?.image_url ?? "");
  const [description, setDescription] = useState(plant?.description ?? "");
  const [tips, setTips] = useState(plant?.tips ?? "");
  const [isToxic, setIsToxic] = useState(Boolean(plant?.is_toxic));

  const submit = async (): Promise<void> => {
    if (!name.trim()) {
      onError("请填写中文名");
      return;
    }
    await onSave({
      name: name.trim(),
      scientific_name: scientificName.trim() || null,
      category: category.trim() || null,
      care_level: Number(careLevel),
      yolo_class_id: yoloId === "" ? null : Number(yoloId),
      light_requirement: light.trim() || null,
      water_requirement: water.trim() || null,
      watering_tip: water.trim() || null,
      temperature_range: temperature.trim() || null,
      humidity_range: humidity.trim() || null,
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      tips: tips.trim() || null,
      is_toxic: isToxic,
    });
  };

  return (
    <Modal
      open={open}
      wide
      title={editing ? "编辑植物条目" : "新建植物条目"}
      subtitle={editing ? `${plant?.name} · #${plant?.id}` : "新条目会出现在养护百科与推荐中。"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn" type="button" onClick={() => void submit()}>
            {editing ? "保存修改" : "创建条目"}
          </button>
        </>
      }
    >
      <form id="pl-form" style={{ display: "grid", gap: "12px" }} onSubmit={(event) => event.preventDefault()}>
        <div className="form-row">
          <Field label="中文名" name="name" value={name} onChange={setName} placeholder="绿萝" />
          <Field
            label="学名"
            name="scientific_name"
            value={scientificName}
            onChange={setScientificName}
            placeholder="Epipremnum aureum"
          />
        </div>
        <div className="form-row form-row--3">
          <Field label="分类" name="category" value={category} onChange={setCategory} placeholder="观叶" />
          <div className="field">
            <label htmlFor="f-care_level">养护难度</label>
            <select
              className="select"
              id="f-care_level"
              name="care_level"
              style={{ width: "100%" }}
              value={careLevel}
              onChange={(event) => setCareLevel(event.target.value)}
            >
              <option value="1">省心</option>
              <option value="2">一般</option>
              <option value="3">费心</option>
            </select>
          </div>
          <Field
            label="YOLO 类别 ID"
            name="yolo_class_id"
            type="number"
            value={yoloId}
            onChange={setYoloId}
            min={0}
            step={1}
            placeholder="0"
          />
        </div>
        <div className="form-row">
          <Field
            label="光照要求"
            name="light_requirement"
            value={light}
            onChange={setLight}
            placeholder="明亮散射光"
          />
          <Field
            label="浇水要求"
            name="water_requirement"
            value={water}
            onChange={setWater}
            placeholder="表土干 2cm 再浇透"
          />
        </div>
        <div className="form-row">
          <Field
            label="温度范围"
            name="temperature_range"
            value={temperature}
            onChange={setTemperature}
            placeholder="18–28℃"
          />
          <Field
            label="湿度范围"
            name="humidity_range"
            value={humidity}
            onChange={setHumidity}
            placeholder="50–70%"
          />
        </div>
        <Field
          label="图片地址"
          name="image_url"
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="../assets/pothos.jpg"
        />
        <div className="field">
          <label htmlFor="f-description">描述</label>
          <textarea
            className="input"
            id="f-description"
            name="description"
            rows={3}
            style={{ height: "auto", padding: "9px 12px", resize: "vertical" }}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="f-tips">养护提示</label>
          <textarea
            className="input"
            id="f-tips"
            name="tips"
            rows={2}
            style={{ height: "auto", padding: "9px 12px", resize: "vertical" }}
            value={tips}
            onChange={(event) => setTips(event.target.value)}
          />
        </div>
        <div className="switch-row">
          <span>
            <b>对宠物有毒</b>
            <small>会显示在养护卡的风险提示里</small>
          </span>
          <label className="switch">
            <input
              type="checkbox"
              name="is_toxic"
              checked={isToxic}
              aria-label="对宠物有毒"
              onChange={(event) => setIsToxic(event.target.checked)}
            />
            <i />
          </label>
        </div>
      </form>
    </Modal>
  );
}
