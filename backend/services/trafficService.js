function getTrafficInfo(origin, destination) {

  const scenarios = [
    { status: "livre", delay: 0 },
    { status: "moderado", delay: 4 },
    { status: "congestionado", delay: 12 }
  ];

  const random = scenarios[Math.floor(Math.random() * scenarios.length)];

  return {
    trafficStatus: random.status,
    extraMinutes: random.delay,
    origin,
    destination
  };
}

module.exports = { getTrafficInfo };
