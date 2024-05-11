/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

/*

current status:
- seems like it's always picking polys around the original cell index, and not branching out

*/

var ShowPoints = false;
var ShowCells = false;

let CanvasHeight = 800;
let CanvasWidth = 400;

var NumRepeatCols = 1;
var NumRepeatRows = 6;

const MaxJoins = 10;

var MaxRowSubdivisions = 3;
var MaxRows = 3;
var MaxCols = 3;

var MirrorCols = true;
var MirrorRows = true;

var EarlyJoinBailoutChance = 0.5;

var Seed = 99;

var Clipper2Z;

function drawCells() {
  // Draw NumRepeatCols x NumRepeatRows grid
  const width = CanvasWidth / NumRepeatCols;
  const height = CanvasHeight / NumRepeatRows;
  for (let row = 0; row < NumRepeatRows; row++) {
    for (let col = 0; col < NumRepeatCols; col++) {
      const x = col * width;
      const y = row * height;
      noStroke();
      if (row == 0 && col == 0) {
        fill(color(255, 204, 0, 100));
      } else {
        fill(
          color(
            noise(row, col) * 255,
            noise(row, col) * 255,
            noise(row, col) * 255,
            100
          )
        );
      }
      rect(x, y, width, height);
    }
  }
}

function maybeRepeatPoint({ x, y, index }) {
  let points = [];
  let labels = [];

  for (let row = 0; row < NumRepeatRows; row++) {
    for (let col = 0; col < NumRepeatCols; col++) {
      const ColWidth = CanvasWidth / NumRepeatCols;
      let canvasX = (col * CanvasWidth) / NumRepeatCols + x;
      console.log({ col });
      if (MirrorCols && col % 2 == 0) {
        console.log({ col, row }, "mirroring");
        canvasX = (col + 1) * ColWidth - x;
      }
      const canvasY = (row * CanvasHeight) / NumRepeatRows + y;
      points.push([canvasX, canvasY]);
      labels.push(`${index}`);
    }
  }

  return { points, labels };
}

function makeInitialVoronoiPoints() {
  let points = [];
  const width = CanvasWidth / NumRepeatCols;
  const height = CanvasHeight / NumRepeatRows;

  // how this got built up
  // - start by building a very regular point distribution with centers evenly spaced, makes an even rectangular tiling
  // - then, within each row, build multiple "subdivisions", where within the subdivision, the points are evenly spaced
  // - next, add some noise to the y position of each point, to make the rows not perfectly straight
  // - and, also, add a constant noise to the y position so that some rows are bunched and others are far
  // this might be insane and unnecessary? (do we need these subdivisions if we end up building global subdivisions?

  const numRows = MaxRows;
  for (let row = 0; row < numRows; row++) {
    const rowSubdivisions = Math.round(random(1, MaxRowSubdivisions));
    for (
      let rowSubdivision = 0;
      rowSubdivision < rowSubdivisions;
      rowSubdivision++
    ) {
      const rowSubdivisionSize = width / rowSubdivisions;
      const startingX = rowSubdivisionSize * rowSubdivision;

      const numCols = Math.round(random(1, MaxCols));
      for (let col = 0; col < numCols; col++) {
        const x =
          startingX +
          (rowSubdivisionSize / numCols) * col +
          rowSubdivisionSize / numCols / 2;
        const rowHeight = height / numRows;
        const y = rowHeight * row + rowHeight / 2; /*+
          (noise(row, col % 2) - 0.5) * rowHeight +
          ((noise(row) - 0.5) * rowHeight) / 2;*/
        console.log({
          row,
          col,
          numRows,
          numCols,
          x,
          y,
        });

        // const c = color(random(0, 255), random(0, 255), random(0, 255));
        points.push([x, y]);
      }
    }
  }

  return points;
}

async function setup() {
  const gui = createGui("My awesome GUI");
  gui.setPosition(CanvasWidth + 100, 50);

  sliderRange(1, 100, 1);
  gui.addGlobals(
    "NumRepeatCols",
    "NumRepeatRows",
    "MaxRowSubdivisions",
    "MaxRows",
    "MaxCols"
  );

  sliderRange(1, 1000000, 1);
  gui.addGlobals("Seed");

  gui.addGlobals("MirrorCols", "ShowCells", "ShowPoints");

  noLoop();

  createCanvas(CanvasWidth, CanvasHeight);

  await Clipper2ZFactory().then((loadedClipper2Z) => {
    console.log("loaded");
    Clipper2Z = loadedClipper2Z;
    draw();
  });
}

function reprocessCells({ voronoi, labels }) {
  // Pick a random cell
  // Find the neighbors
  // Join to one of them if it hasn't already been squished to something
  // Repeat until we decide to stop
  // Do the same for all cells with the same label

  const cellIndexToLabelMap = {};
  for (let i = 0; i < labels.length; i++) {
    cellIndexToLabelMap[i] = labels[i];
  }

  const labelToCellListMap = {};
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!labelToCellListMap[label]) {
      labelToCellListMap[label] = [];
    }
    labelToCellListMap[label].push(i);
  }

  const polygonUseMap = [];
  const finalPolys = [];
  // TODO: this is horribly inefficient due to array re-allocation
  let allPolygonIndices = [...Array(labels.length).keys()];

  function makeOneRun() {
    const cells = [...voronoi.cellPolygons()];
    let currentCellIndex = allPolygonIndices.pop();

    if (polygonUseMap[currentCellIndex]) {
      return false;
    }

    let polygonInProgress = makeClipperPathFromPointsArray(
      cells[currentCellIndex]
    );

    polygonUseMap[currentCellIndex] = true;

    let numJoinsPerformed = 0;
    while (numJoinsPerformed < MaxJoins) {
      const neighbors = voronoi.neighbors(currentCellIndex);
      const unusedNeighbors = [
        ...neighbors.filter((neighborIndex) => {
          return !polygonUseMap[neighborIndex];
        }),
      ];

      if (unusedNeighbors.length == 0) {
        break;
      }
      // pick a random neighbor
      const randomNeighborIndex = _.sample(unusedNeighbors);
      polygonUseMap[randomNeighborIndex] = true;
      allPolygonIndices = allPolygonIndices.filter(
        (index) => index != randomNeighborIndex
      );

      const clipperPath2 = makeClipperPathFromPointsArray(
        cells[randomNeighborIndex]
      );
      const { FillRule, UnionD } = Clipper2Z;
      polygonInProgress = UnionD(
        polygonInProgress,
        clipperPath2,
        FillRule.NonZero,
        2
      );

      numJoinsPerformed += 1;

      currentCellIndex = randomNeighborIndex;

      if (random() < EarlyJoinBailoutChance) {
        break;
      }
    }

    const unionedPointsPath =
      getPointsArraysFromClipperPaths(polygonInProgress);

    finalPolys.push(unionedPointsPath[0]);
    return true;
  }

  while (allPolygonIndices.length > 0) {
    makeOneRun();
  }

  finalPolys.forEach((poly) => {
    fill(random(255), random(255), random(255));
    beginShape();
    for (let point of poly) {
      vertex(point[0], point[1]);
    }
    endShape(CLOSE);
  });
}

function draw() {
  if (!Clipper2Z) {
    return;
  }

  randomSeed(Seed);
  noiseSeed(Seed);

  background(120);
  const initialPoints = makeInitialVoronoiPoints();

  let labels = [];
  const finalPoints = initialPoints.flatMap(([x, y], index) => {
    const { points, labels: newLabels } = maybeRepeatPoint({ x, y, index });
    labels = labels.concat(newLabels);
    return points;
  });


  const delaunay = d3.Delaunay.from(finalPoints);
  const voronoi = delaunay.voronoi([0, 0, CanvasWidth, CanvasHeight]);
  const cells = voronoi.cellPolygons();

  reprocessCells({ voronoi, labels });

  let i = 0;
  for (let cell of cells) {
    if (ShowCells) {
      fill(255, 255, 255, 0);
      beginShape();

      for (let point of cell) {
        vertex(point[0], point[1]);
      }
      endShape(CLOSE);
    }

    // draw point
    if (ShowPoints) {
      const x = finalPoints[i][0];
      const y = finalPoints[i][1];
      fill(0, 0, 0);
      ellipse(x, y, 2, 2);
    }

    i++;

    // const clipperPath = makeClipperPathFromPointsArray(cell)
    // console.log({clipperPath})
    // const { InflatePathsD, JoinType, EndType } = Clipper2Z;
    // const deflated1 = InflatePathsD(clipperPath, 10, JoinType.Round, EndType.Polygon, 20, 1, 5);
    // const deflated = InflatePathsD(clipperPath, -20, JoinType.Round, EndType.Polygon, 20, 1, 5);
    // console.log(deflated.size())
    // const shapes = getPointsArraysFromClipperPaths(deflated);
    // for (let shape of shapes) {
    //   fill(0, 0, 100, 100);
    //   beginShape();
    //   for (let point of shape) {
    //     vertex(point[0], point[1]);
    //   }
    //   endShape(CLOSE);
    // }
  }
}

// Clipper Utility functions
function makeClipperPathFromPointsArray(points) {
  const { PathsD, MakePathD } = Clipper2Z;
  const subject = new PathsD();
  console.log(points.flat());
  subject.push_back(MakePathD(points.flat()));
  return subject;
}

function getPointsArraysFromClipperPaths(clipperPaths) {
  const paths = [];
  const size = clipperPaths.size();
  for (let i = 0; i < size; i++) {
    const path = getPointsArrayFromClipperPath(
      clipperPaths.get(i),
      color,
      closed
    );
    paths.push(path);
  }
  return paths;
}

function getPointsArrayFromClipperPath(clipperPath) {
  const size = clipperPath.size();
  console.log({ size });

  let points = [];
  for (let i = 0; i < size; i++) {
    const point = clipperPath.get(i);
    points.push([point.x, point.y]);
  }
  return points;
}
