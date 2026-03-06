export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const PLACE_ID = 'ChIJUTh_onXBwogRBQTn1S1xSBQ';
  const API_KEY  = process.env.GOOGLE_MAPS_API_KEY;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=name,rating,user_ratings_total,reviews&reviews_sort=newest&key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(500).json({ error: 'Places API error', status: data.status });
    }

    const place = data.result;

    // Only return 5-star reviews with meaningful text
    const reviews = (place.reviews || [])
      .filter(r => r.rating >= 4 && r.text && r.text.length > 40)
      .slice(0, 6)
      .map(r => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        time: r.relative_time_description,
        photo: r.profile_photo_url,
      }));

    res.status(200).json({
      name: place.name,
      rating: place.rating,
      total: place.user_ratings_total,
      reviews,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
