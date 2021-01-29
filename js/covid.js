const Activity = {
    HOME: 0,
    PRIMARY_SCHOOL: 1,
    SECONDARY_SCHOOL: 2,
    WORK: 3,
    SHOPPING: 4,
}

const Status = {
    SUSCEPTIBLE: 0,
    INCUBATING: 1,
    PRESYMPTOMATIC: 2,
    ASYMPTOMATIC: 3,
    SYMPTOMATIC: 4,
    RECOVERED: 5,
    DEAD: 6,
}

const initParams = function () {
    return {
        // Decreases in time at non-home activities during lockdown
        symptomaticMultiplier: 0.5,
        lockdownMultiplier: 0.5,

        // Proportions
        symptomaticProb: 0.6,

        // Duration probability distributions
        exposedScale: 2.82,
        exposedShape: 3.99,
        presymptomaticScale: 2.45,
        presymptomaticShape: 7.79,
    };
}

const initPlaces = function (nPlaces) {
    return {
        size: nPlaces,
        hazard: new Float32Array(nPlaces),
        count: new Int32Array(nPlaces),
        activity: new Int8Array(nPlaces),
    };
}

const randomPlaces = function (nPlaces) {
    const places = initPlaces(nPlaces);
    for (let i = 0; i < places.size; i++) {
        places.activity[i] = Math.random() * 5;
    }
    return places;
}

const initPeople = function (nPeople) {
    return {
        size: nPeople,
        age: new Int8Array(nPeople),
        status: new Int8Array(nPeople),
        hazard: new Float32Array(nPeople),
        transitionTime: new Int16Array(nPeople),
    };
}

const randomPeople = function (nPeople) {
    const people = initPeople(nPeople);
    for (let i = 0; i < people.size; i++) {
        people.age[i] = Math.random() * 100;
    }
    return people;
}

const initFlows = function (nFlows) {
    return {
        size: nFlows,
        from: new Int32Array(nFlows),
        to: new Int32Array(nFlows),
        baseFlow: new Float32Array(nFlows),
        flow: new Float32Array(nFlows),
    };
}

const randomFlows = function(nFlows, nPlaces, nPeople) {
    const flows = initFlows(nFlows);
    for (let i = 0; i < nFlows; i++) {
        flows.from[i] = Math.random() * nPeople;
        flows.to[i] = Math.random * nPlaces;
        flows.baseFlow[i] = Math.random();
    }
    return flows;
}

const resetPlaces = function (places) {
    for (let i = 0; i < places.size; i++) {
        places.hazard[i] = 0.0;
        places.count[i] = 0;
    }
}

const resetPeople = function (people) {
    for (let i = 0; i < people.size; i++) {
        people.hazard[i] = 0.0;
    }
}

const updateFlows = function (params, people, flows) {
    for (let i = 0; i < flows.size; i++) {
        const status = people.status[flows.from[i]];
        const activity = places.activity[flows.to[i]];

        const baseFlow = flows.baseFlow[i];
        let multiplier = params.lockdownMultiplier;
        if (status == Status.SYMPTOMATIC) multiplier *= params.symptomaticMultiplier;

        if (activity == Activity.HOME) {
            flows.flow[i] = 1.0 - (1.0 - baseFlow) * multiplier;
        } else {
            flows.flow[i] = baseFlow * multiplier;
        }
    }
}

const sendHazard = function (people, places, flows) {
    for (let i = 0; i < flows.size; i++) {
        const status = people.status[flows.from[i]];
        if (Status.INCUBATING < status && status < Status.RECOVERED) {
            places.hazard[flows.to[i]] += flows.flow[i];
        }
    }
}

const recvHazard = function (people, places, flows) {
    for (let i = 0; i < flows.size; i++) {
        const status = people.status[flows.from[i]];
        if (status == Status.INCUBATING) {
            places.hazard[flows.to[i]] += flows.flow[i];
        }
    }
}

const updateStatus = function (params, people) {
    for (let i = 0; i < people.size; i++) {
        let status = people.status[i];
        let transitionTime = people.transitionTime

        if (status == Status.SUSCEPTIBLE) {
            const prob = 1.0 - Math.exp(-people.hazard[i]);
            if (Math.random() < prob) {
                status = Status.INCUBATING;
                transitionTime = 5;
            }
        } else if (transitionTime <= 0) {
            if (status == Status.INCUBATING) {
                status = (Math.random() < params.symptomaticProb) ? Status.PRESYMPTOMATIC : Status.ASYMPTOMATIC;
                transitionTime = (status == Status.PRESYMPTOMATIC) ? 6 : 3;
            } else if (status == Status.PRESYMPTOMATIC) {
                status = Status.SYMPTOMATIC;
                transitionTime = 5
            } else if (status == Status.ASYMPTOMATIC) {
                status = Status.RECOVERED;
                transitionTime = 0;
            } else if (status == Status.SYMPTOMATIC) { 
                status = (Math.random() < 0.99) ? Status.RECOVERED : Status.DEAD;
                transitionTime = 0;
            }
        }

        people.status[i] = status;
        people.transitionTime[i] = transitionTime - 1;
    }
}

const update = function (params, people, places, flows) {
    resetPlaces(places);
    resetPeople(people);
    updateFlows(params, people, flows);
    sendHazard(people, places, flows);
    recvHazard(people, places, flows);
    updateStatus(params, people);
}

const nPlaces = 500;
const nPeople = 10000;
const nFlows = 30000;

const params = initParams();
const places = randomPlaces(nPlaces);
const people = randomPeople(nPeople);
const flows = randomFlows(nFlows);

update(params, people, places, flows);
