{
  if ($0 ~ /router\.project-osrm\.org\/route\/v1\/driving/) {
    print "  const base = \"https://router.project-osrm.org/route/v1/driving/\";";
    next;
  }
  print;
}
