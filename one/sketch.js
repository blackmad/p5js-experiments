
let CanvasHeight = 800;
let CanvasWidth = 400;

var NumRepeatCols = 1;
var NumRepeatRows = 6;

var MaxRowSubdivisions = 3;
var MaxRows = 3;
var MaxCols = 3;

var MirrorCols = true;
var MirrorRows = true;

var Seed = 99;



function drawCells() {
  // Draw NumRepeatCols x NumRepeatRows grid
  const width = CanvasWidth / NumRepeatCols;
  const height = CanvasHeight / NumRepeatRows;
  for (let row = 0; row < NumRepeatRows; row++) {
    for (let col = 0; col < NumRepeatCols; col++) {
      const x = col * width;
      const y = row * height;
      noStroke();
      if (row == 0 && col == 0)  {
        fill(color(255, 204, 0, 100))
      } else {
        fill(color(noise(row, col)*255, noise(row, col)*255, noise(row, col)*255, 100));
      }
      rect(x, y, width, height);
    }
  }
}


function addPoint({x, y}) {
  for (let row = 0; row < NumRepeatRows; row++) {
    for (let col = 0; col < NumRepeatCols; col++) {
      const ColWidth = CanvasWidth / NumRepeatCols;
      let canvasX = col * CanvasWidth / NumRepeatCols + x;
      console.log({col})
      if (MirrorCols && ((col %2) == 0)) {
        console.log({col, row}, "mirroring")
        canvasX = (col + 1) * ColWidth - x;
      }
        // (MirrorCols ?  ColWidth - x:  x);

      const canvasY = row * CanvasHeight / NumRepeatRows + y;
      voronoiSite(canvasX, canvasY, 255);
    }
  }
}

function fillVoronoiPoints() {
  const width = CanvasWidth / NumRepeatCols;
  const height = CanvasHeight / NumRepeatRows;

  // how this got built up
  // - start by building a very regular point distribution with centers evenly spaced, makes an even rectangular tiling
  // - then, within each row, build multiple "subdivisions", where within the subdivision, the points are evenly spaced
  // - next, add some noise to the y position of each point, to make the rows not perfectly straight
  // - and, also, add a constant noise to the y position so that some rows are bunched and others are far
  // this might be insane and unnecessary? (do we need these subivisions if we end up building global subdivisions?

  const numRows = MaxRows;
  for (let row = 0; row < numRows; row++) {
    const rowSubdivisions = Math.round(random(1, MaxRowSubdivisions));
    for (let rowSubdivision = 0; rowSubdivision < rowSubdivisions; rowSubdivision++) {
      const rowSubdivisionSize = width / rowSubdivisions;
      const startingX = rowSubdivisionSize * rowSubdivision;

      const numCols = Math.round(random(1, MaxCols));
      for (let col = 0; col < numCols; col++) {
        const x = startingX + (rowSubdivisionSize / numCols) * col + (rowSubdivisionSize / numCols) / 2
        const rowHeight = height / numRows;
        const y = rowHeight * row + rowHeight / 2
          + (noise(row, col % 2) - 0.5) * rowHeight
          + (noise(row) - 0.5) * rowHeight / 2;
        console.log({
          row, col,
          numRows, numCols,
          x, y
        })

        // const c = color(random(0, 255), random(0, 255), random(0, 255));
        addPoint({x, y});        
      }
    }
  }
}

function setup() {
  const gui = createGui('My awesome GUI');
  sliderRange(1, 10, 1);
  gui.addGlobals('NumRepeatCols', 'NumRepeatRows', 'MaxRowSubdivisions', 'MaxRows', 'MaxCols'); 


  noLoop();

  randomSeed(Seed);
  noiseSeed(Seed);

  createCanvas(CanvasWidth, CanvasHeight);
}

function draw() {
  background(120);
  fillVoronoiPoints();
  voronoi(CanvasWidth, CanvasHeight, true);
  voronoiDraw(0, 0, true, false);
  // drawCells();

}
