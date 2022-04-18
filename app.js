async function run() {
    console.log("THIS IS A TEST")
    await new Promise((r) => setTimeout(r, 10800000)); //Delay by 3 hours
}

run()

