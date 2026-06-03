-- Fix middle-dot (shows as ??) in room short_description + broken ROOM 101 image
USE caza_buena;

UPDATE rooms
SET short_description = CONCAT(
  IF(room_type = 'suite', 'Two-bedroom suite', 'One-bedroom queen'),
  ' - Floor ',
  FLOOR(sort_order / 100)
)
WHERE sort_order >= 100;

UPDATE room_images
SET image_url = 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800'
WHERE image_url LIKE '%1611892440504%';
