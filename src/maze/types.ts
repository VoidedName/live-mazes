import { exhaust_switch } from "../utils/switch"

export type Cell = {
    x: number,
    y: number,
    walls: {
        north: boolean,
        south: boolean,
        west: boolean,
        east: boolean,
    }
}

export function Cell(x: number, y: number): Cell {
    return {
        x,
        y,
        walls: {
            north: true,
            south: true,
            west: true,
            east: true,
        }
    }
}

export type Maze = {
    columns: number,
    rows: number,
    cells: Cell[][],
}

export function Maze(rows: number, columns: number): Maze {
    return {
        columns,
        rows,
        cells: new Array(rows)
                .fill(null)
                .map((_, y) => 
                    new Array(columns)
                        .fill(null)
                        .map((_, x) => Cell(x, y))
                    )
    }
}

export type MazeGenerationHistory = Maze[];

export function copy_maze(maze: Maze): Maze {
    return {
        ...maze,
        cells: maze.cells.map(row => row.map(cell => ({...cell, walls: {...cell.walls}})))
    }
}

export const Direction = {
    "N" : "N",
    "E" : "E",
    "S" : "S",
    "W" : "W",
} as const;
export type Direction = keyof typeof Direction;

export const OptionalDirection = {
    ...Direction,
    "None" : "None"
} as const;
export type OptionalDirection = Direction | "None"

export function carve_path(cell: Cell, maze: Maze, direction: OptionalDirection) {
     switch (direction) {
         case "N": 
             cell.walls.north = false;
             maze.cells[cell.y-1][cell.x].walls.south = false;
             break;
         case "S": 
             cell.walls.south = false;
             maze.cells[cell.y+1][cell.x].walls.north = false;
             break;
         case "E": 
             cell.walls.east = false;
             maze.cells[cell.y][cell.x+1].walls.west = false;
             break;
         case "W": 
             cell.walls.west = false;
             maze.cells[cell.y][cell.x-1].walls.east = false;
             break;
         case "None":
             break;
         default: exhaust_switch(direction)
     }
}

function edge_conditions(cell: Cell, maze: Maze): {
    is_left_edge : boolean,
    is_top_edge : boolean, 
    is_right_edge : boolean, 
    is_bottom_edge : boolean, 
} {
    const is_left_edge = cell.x === 0;
    const is_top_edge = cell.y === 0;
    const is_right_edge = cell.x === maze.columns - 1;
    const is_bottom_edge = cell.y === maze.rows - 1;
    
    return {
        is_top_edge,
        is_left_edge,
        is_bottom_edge,
        is_right_edge
    }
}

export function noclip_directions_for(cell: Cell, maze: Maze): Direction[] {
    const {
        is_right_edge, 
        is_bottom_edge, 
        is_left_edge, 
        is_top_edge
    } = edge_conditions(cell, maze);

    let options = new Set(Object.keys(Direction) as Direction[])
  
    if (is_top_edge) options.delete(Direction.N)
    if (is_bottom_edge) options.delete(Direction.S)
    if (is_right_edge) options.delete(Direction.E)
    if (is_left_edge) options.delete(Direction.W)

    return [...options]
}

export function move_dir(cell: Cell, maze: Maze, direction: OptionalDirection): Cell {
     switch (direction) {
         case "N": 
             return maze.cells[cell.y-1][cell.x]
         case "S": 
             return maze.cells[cell.y+1][cell.x]
         case "E": 
             return maze.cells[cell.y][cell.x+1]
         case "W": 
             return maze.cells[cell.y][cell.x-1]
         case "None":
             return cell;
         default: exhaust_switch(direction)
     }
}

export function adjacent_cells(cell: Cell, maze: Maze): Cell[] {
    let results = [];
    
    const {
        is_right_edge, 
        is_bottom_edge, 
        is_left_edge, 
        is_top_edge
    } = edge_conditions(cell, maze);
    
    if (!is_left_edge) {
        results.push(maze.cells[cell.y][cell.x-1])
    }
    if (!is_right_edge) {
        results.push(maze.cells[cell.y][cell.x+1])
    }
    if (!is_top_edge) {
        results.push(maze.cells[cell.y-1][cell.x])
    }
    if (!is_bottom_edge) {
        results.push(maze.cells[cell.y+1][cell.x])
    }

    return results;
}

export function neighbors(cell: Cell, maze: Maze): Cell[] {
    let results = [];

    const {
        is_right_edge, 
        is_bottom_edge, 
        is_left_edge, 
        is_top_edge
    } = edge_conditions(cell, maze);

    if (!is_left_edge && !cell.walls.west) {
        results.push(maze.cells[cell.y][cell.x-1])
    }
    if (!is_right_edge && !cell.walls.east) {
        results.push(maze.cells[cell.y][cell.x+1])
    }
    if (!is_top_edge && !cell.walls.north) {
        results.push(maze.cells[cell.y-1][cell.x])
    }
    if (!is_bottom_edge && !cell.walls.south) {
        results.push(maze.cells[cell.y+1][cell.x])
    }

    return results;
}

export function cell_id(cell: Cell): string {
    return `${cell.x}:${cell.y}`;
}

export function draw_maze_console(maze: Maze) {
    const vertical_wall = "|"
    const horizontal_wall = "--"
    const horizontal_door = "  "
    const vertical_door = " "
    const corner = "+"
    const space = "  "

    let result = ""
    let first_row = true;
    for (const row of maze.cells) {
        let first_colum = true;
        if (first_row) {
            result += "\n"
            first_row = false
            if (first_colum) {
                result += corner
                first_colum = false;
            }
            for (const cell of row) {
                let top = horizontal_door;
                if (cell.walls.north) top = horizontal_wall
                result += `${top}${corner}`
            }
        }
        result += "\n"
        first_colum = true;
        for (const cell of row) {
            if (first_colum) {
                let left = vertical_door
                if (cell.walls.west) left = vertical_wall
                result += left
                first_colum = false;
            }
            let right_side = vertical_door;
            if (cell.walls.east) right_side = vertical_wall
            result += `${space}${right_side}`
        }
        result += "\n"
        first_colum = true;
        for (const cell of row) {
            if (first_colum) {
                result += corner
                first_colum = false;
            }
            let bottom = horizontal_door;
            if (cell.walls.south) bottom = horizontal_wall
            result += `${bottom}${corner}`
        }
    }

    console.log(result)
}
