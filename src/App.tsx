import PRNG from 'random-seedable/@types/PRNG';
import './App.css'
import { Cell, Direction, Maze, OptionalDirection, carve_path, cell_id, move_dir, neighbors, noclip_directions_for } from './maze/types'
import { XORShift64 } from "random-seedable"
import {useState} from "react"
import { exhaust_switch } from './utils/switch';

// bias: nr between 0 and 1, this dictates how likely we are to go to the right
function generate_maze_binary_tree(cols: number, rows: number, r: PRNG, bias: number): Maze {
    const maze = Maze(rows, cols);
   
    // Maze: Exaclty one path between ANY point A and B => No Cycles & No Islands
    //
    // for row: 
    //    for every cell carve path right or up.
    //    bias towards right.
    //

    type LocalDirection = Exclude<OptionalDirection, "S" | "W"> 
    for (let row of maze.cells) {
        for (let cell of row) {
            // decide direction to go
            // what if we're at the right edge / top edge? => pick the only available direction 
            // top right corner does nothing
            let dir: LocalDirection;
            const is_right_edge = cell.x === maze.columns - 1;
            const is_top_edge = cell.y === 0;

            if (is_top_edge && is_right_edge) { 
                dir = "None"
            } else if (is_right_edge) {
                dir = "N";
            } else if (is_top_edge) {
                dir = "E"
            } else {
                if (r.float() < bias) {
                    dir = "E"
                } else {
                    dir = "N"
                }
            }

            carve_path(cell, maze, dir)
        }
    }

    return maze;
}
// bias: nr between 0 and 1, this dictates how likely we are to go to the right
function generate_maze_sidewinder(cols: number, rows: number, r: PRNG, bias: number): Maze {
    const maze = Maze(rows, cols);
   
    // Maze: Exaclty one path between ANY point A and B => No Cycles & No Islands
    //
    // for row: 
    //    for every cell carve path right or up.
    //      if we're going up, we're going to pick a random one from the current run
    //    bias towards right.
    // *run = from the last break to the next break (decision to go up)

    type LocalDirection = Exclude<OptionalDirection, "S" | "W"> 
    for (let row of maze.cells) {
        let left = 0;
        let right = left;
        for (let cell of row) {
            right += 1;
            // decide direction to go
            // what if we're at the right edge / top edge? => pick the only available direction 
            // top right corner does nothing
            let dir: LocalDirection;
            const is_right_edge = cell.x === maze.columns - 1;
            const is_top_edge = cell.y === 0;

            if (is_top_edge && is_right_edge) {
                dir = "None"
            } else if (is_right_edge) {
                dir = "N";
            } else if (is_top_edge) {
                dir = "E"
            } else {
                if (r.float() < bias) {
                    dir = "E"
                } else {
                    dir = "N"
                }
            }

            // carve path
            switch (dir) {
                case "N":
                    let candidate = left + r.randBelow(right - left)
                    cell = row[candidate]; 
                    carve_path(cell, maze, dir)
                    left = right;
                    break;
                default:
                    carve_path(cell, maze, dir)
                    break;
            }
        }
    }

    return maze;
}

function generate_maze_random_walk(width: number, height: number, r: PRNG): Maze {
    let maze = Maze(width, height)
    
    // pick random starting cell
    // until all cells have been visited
    //      pick random direction and go to that cell
    //      if that cell has been already visited, continue
    //      else break the wall between the two cells, mark the new cell visited
 
    let x_start = r.randBelow(width)
    let y_start = r.randBelow(height)
    let current = maze.cells[y_start][x_start]
    let visited = new Set<Cell>([current])

    const size = width * height

    while (visited.size < size) {
        let options = noclip_directions_for(current, maze)
        let dir = r.choice(options)
        let next_cell = move_dir(current, maze, dir)
        
        let is_new = !visited.has(next_cell)

        if (is_new) {
             carve_path(current, maze, dir)
             visited.add(next_cell)
        }

        current = next_cell
    }

    return maze;
}

function DrawMaze({maze, height, width}: {
    maze: Maze, 
    height: number, 
    width: number
}) {
    const cell_height = height / maze.rows;
    const cell_width = width / maze.columns;

    const cell_size = Math.min(cell_height, cell_width);
    const x_offset = (width - (maze.columns * cell_size)) / 2
    const y_offset = (height - (maze.rows * cell_size)) / 2
    
    const color = "white"

    return <g id="walls" transform={`translate(${x_offset}, ${y_offset})`}>
        <path d={`M0 0 l ${cell_size * maze.columns} 0`} stroke={color}/>
        <path d={`M0 0 l 0 ${cell_size * maze.rows}`} stroke={color}/>
        {maze.cells.flatMap(
            row => { 
                return row.map(
                cell => {
                    const {x, y} = cell;
                    const {north: n, south: s, west: w, east: e} = cell.walls
                    return <>
                        {/*n && <path 
                            d={`M${x * cell_size} ${y * cell_size} l${cell_size} 0`} 
                            stroke={color}
                        /> */}
                        {s && <path 
                            d={`M${x * cell_size} ${(y + 1) * cell_size} l${cell_size} 0`} 
                            stroke={color}
                        />}
                        {/*w && <path 
                            d={`M${x * cell_size} ${y * cell_size} l0 ${cell_size}`} 
                            stroke={color}
                        />*/}
                        {e && <path 
                            d={`M${(x + 1) * cell_size} ${y * cell_size} l0 ${cell_size}`} 
                            stroke={color}
                        />}
                    </>
                })
            })
        }
    </g>
}

// mutates distances in place
// "max" is reserved for max distance && is never 0
function compute_distances(cell: Cell, maze: Maze, distances: Record<string, number>) {
    let queue: Cell[] = [cell];
    let visited: Set<Cell> = new Set([cell]);
    distances[cell_id(cell)] = 0;

    let current: Cell;
    let max_distance = 1;
    while (queue.length > 0) {
        current = queue.shift()!;
        let n = neighbors(current, maze);
        for (let other of n) {
            if (!visited.has(other)) {
                let d = distances[cell_id(current)] + 1;
                distances[cell_id(other)] = d;
                visited.add(other);
                queue.push(other);
                max_distance = Math.max(max_distance, d);
            }
        }
    }
    distances["max"] = max_distance;
}

function TextureRenderer({maze, height, width}: {
    maze: Maze, 
    height: number, 
    width: number
}) {
    const [from_cell, set_from_cell] = useState<Cell|null>(null);
    const [distances] = useState<Record<string, number>>({});
    const cell_height = height / maze.rows;
    const cell_width = width / maze.columns;

    const cell_size = Math.min(cell_height, cell_width);
    const x_offset = (width - (maze.columns * cell_size)) / 2
    const y_offset = (height - (maze.rows * cell_size)) / 2
    
    const color = "#33CCFF"
    let max_distance = distances["max"]!;

    return <g id="walls" transform={`translate(${x_offset}, ${y_offset})`}>
        {maze.cells.flatMap(
            row => { 
                return row.map(
                cell => {
                    let actual_distance = distances[cell_id(cell)];
                    const {x, y} = cell;
                    return <>
                        {<path
                            pointerEvents="fill"
                            d={`
                            M${x * cell_size} ${y * cell_size} 
                            l${cell_size} 0
                            l0 ${cell_size}
                            l${-cell_size} 0
                            z 
                            `}
                            onMouseEnter={(event) => { set_from_cell(cell); compute_distances(cell, maze, distances)}}
                            onMouseLeave={(event) => set_from_cell(before => before === cell ? null : before)}
                            stroke={color}
                            strokeOpacity="0.0"
                            fill={color}
                            fillOpacity={from_cell === null ? 0 :  actual_distance/max_distance}
                        />}
                    </>
                })
            })
        }
    </g>
}

const Algorithm = {
    "side-winder"   : "side-winder",
    "binary"        : "binary",
    "random-walk"   : "random-walk",
} as const
type Algorithm = keyof typeof Algorithm;

function App() {
    const [algorith, set_algorithm] = useState<Algorithm>("side-winder");
    const [show_texture, set_show_texture] = useState<boolean>(false);

    let maze: Maze;
    
    switch (algorith) {
        case "side-winder":
             maze = generate_maze_sidewinder(25, 25, new XORShift64(2023), 0.8)
             break;
        case "binary":
             maze = generate_maze_binary_tree(25, 25, new XORShift64(2024), 0.5)
             break;
        case "random-walk":
             maze = generate_maze_random_walk(25, 25, new XORShift64(2025))
             break;
        default: 
            exhaust_switch(algorith)
    }

    const width = 400;
    const height = 400;
    const padding = 1;
    
    return (
        <>
        <div>
        <label>Generation Algorithm: 
            <select onChange={(value) => set_algorithm(value.target.value as Algorithm)}>
                {(Object.keys(Algorithm) as Algorithm[])
                    .map(k => <option key={k} value={k}>{Algorithm[k]}</option>)}
            </select>
        </label>
        <label>Show Texture
            <input type="checkbox" onChange={(value) => set_show_texture(value.target.checked)} />
        </label>
        {show_texture && "Show Texture"}
        </div>
        <svg width={width} height={height}>
            <g transform={`translate(${padding}, ${padding})`}>
                {show_texture && <TextureRenderer maze={maze} width={width-2*padding} height={height-2*padding} />}
                <DrawMaze maze={maze} width={width-2*padding} height={height-2*padding} />
            </g>
        </svg>
        </>
    )
}

export default App
