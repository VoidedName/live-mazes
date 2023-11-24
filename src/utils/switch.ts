export function exhaust_switch(discriminator: never): never {
    throw new Error(`Switch was not exhausted! Got '${discriminator}'`)
}
