import { DomUtil, Tooltip, point } from "leaflet";

// Leaflet 1.9.4 positions a tooltip by reading its offsetWidth/offsetHeight
// and then swapping four direction classes and writing its transform. During
// a flight or a smooth zoom that runs for every open tooltip on every frame;
// each read after the previous tooltip's writes forces a full layout, and
// each class swap a restyle. Together they were most of the main-thread
// time left in those animations.
//
// Same positioning maths as Leaflet's, but the size is measured once and
// reused until the content changes or web fonts arrive, and the direction
// class is only touched when the direction actually changes.

let fontGeneration = 0;
if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener("loadingdone", () => {
    fontGeneration += 1;
  });
}

const DIRECTION_CLASSES = ["right", "left", "top", "bottom"].map(
  (direction) => `leaflet-tooltip-${direction}`
);

const originalUpdate = Tooltip.prototype.update;

Tooltip.prototype.update = function update() {
  this._bhSize = null;
  return originalUpdate.call(this);
};

Tooltip.prototype._setPosition = function setPosition(pos) {
  const map = this._map;
  const container = this._container;

  let size = this._bhSize;
  if (!size || size.generation !== fontGeneration || size.width === 0) {
    size = {
      width: container.offsetWidth,
      height: container.offsetHeight,
      generation: fontGeneration,
    };
    this._bhSize = size;
  }

  const offset = point(this.options.offset);
  const anchor = this._getAnchor();
  let direction = this.options.direction;
  let subX;
  let subY;

  if (direction === "top") {
    subX = size.width / 2;
    subY = size.height;
  } else if (direction === "bottom") {
    subX = size.width / 2;
    subY = 0;
  } else if (direction === "center") {
    subX = size.width / 2;
    subY = size.height / 2;
  } else if (direction === "right") {
    subX = 0;
    subY = size.height / 2;
  } else if (direction === "left") {
    subX = size.width;
    subY = size.height / 2;
  } else if (
    map.layerPointToContainerPoint(pos).x < map.latLngToContainerPoint(map.getCenter()).x
  ) {
    direction = "right";
    subX = 0;
    subY = size.height / 2;
  } else {
    direction = "left";
    subX = size.width + (offset.x + anchor.x) * 2;
    subY = size.height / 2;
  }

  const placed = pos.subtract(point(subX, subY, true)).add(offset).add(anchor);

  if (this._bhDirection !== direction) {
    DIRECTION_CLASSES.forEach((name) => DomUtil.removeClass(container, name));
    DomUtil.addClass(container, `leaflet-tooltip-${direction}`);
    this._bhDirection = direction;
  }
  DomUtil.setPosition(container, placed);
};
