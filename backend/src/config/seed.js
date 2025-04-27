const mongoose = require('mongoose');
const User = require('../models/user.model');
const Category = require('../models/category.model');
const Product = require('../models/product.model');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Debug: print resolved .env path and raw contents
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Debug: print all env variables starting with MONGODB
Object.keys(process.env).filter(k => k.startsWith('MONGODB')).forEach(k => console.log(k + ':', process.env[k]));
console.log('MONGODB_URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const users = [
  {
    name: 'Admin User',
    email: 'admin@bazaar.com',
    password: 'admin123',
    role: 'admin',
    firebaseUid: 'seed-admin-uid-1', 
    isActive: true
  },
 
];

const categories = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronics and gadgets for everyday use',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661',
    featured: true,
    order: 1
  },
  {
    name: 'Clothing',
    slug: 'clothing',
    description: 'Fashion and apparel for all seasons',
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f',
    featured: true,
    order: 2
  },
  {
    name: 'Home',
    slug: 'home',
    description: 'Everything you need for your home',
    image: 'https://images.unsplash.com/photo-1538688423619-a81d3f23454b',
    featured: true,
    order: 3
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Enhance your style with our accessories',
    image: 'https://images.unsplash.com/photo-1576053139778-7e32f2b3e5a9',
    featured: false,
    order: 4
  },
  {
    name: 'Furniture',
    slug: 'furniture',
    description: 'Quality furniture for every room',
    image: 'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c',
    featured: true,
    order: 5
  },
  {
    name: 'Beauty',
    slug: 'beauty',
    description: 'Premium beauty and skincare products',
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b',
    featured: true,
    order: 6
  },
  {
    name: 'Sports',
    slug: 'sports',
    description: 'Equipment and apparel for all sports enthusiasts',
    image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b',
    featured: false,
    order: 7
  },
  {
    name: 'Books',
    slug: 'books',
    description: 'Bestsellers, classics, and educational books',
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
    featured: false,
    order: 8
  },
  {
    name: 'Toys',
    slug: 'toys',
    description: 'Fun toys and games for all ages',
    image: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7',
    featured: false,
    order: 9
  },
  {
    name: 'Automotive',
    slug: 'automotive',
    description: 'Parts and accessories for your vehicle',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
    featured: false,
    order: 10
  }
];

// Product images for different categories
const productImages = {
  Electronics: [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12',
    'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed',
    'https://images.unsplash.com/photo-1546435770-a3e426bf472b',
    'https://images.unsplash.com/photo-1581993192873-bf5f4b531bf9',
    'https://images.unsplash.com/photo-1550009158-9ebf69173e03',
    'https://images.unsplash.com/photo-1600003263720-95b45a4035d5',
    'https://images.unsplash.com/photo-1593642702749-b7d2a804fbcf',
    'https://images.unsplash.com/photo-1629429407759-92a78a51b099',
    'https://images.unsplash.com/photo-1560849815-5b5c0fe24e03',
    'https://images.unsplash.com/photo-1512054502232-10a0a035d672',
    'https://images.unsplash.com/photo-1543512214-318c7553f230',
    'https://images.unsplash.com/photo-1625961576929-03f8d36328fe',
    'https://images.unsplash.com/photo-1616410011236-7a42121dd981',
    'https://images.unsplash.com/photo-1515704089429-fd06e6668458'
  ],
  Clothing: [
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27',
    'https://images.unsplash.com/photo-1562157873-818bc0726f68',
    'https://images.unsplash.com/photo-1578932750294-f5075e85f44a',
    'https://images.unsplash.com/photo-1571945153237-4929e783af4a',
    'https://images.unsplash.com/photo-1602293589930-45aad59ba3ab',
    'https://images.unsplash.com/photo-1542060748-10c28b62716f',
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f',
    'https://images.unsplash.com/photo-1556306535-0f09a537f0a3',
    'https://images.unsplash.com/photo-1516762689617-e1cffcef479d',
    'https://images.unsplash.com/photo-1554568218-0f1715e72254',
    'https://images.unsplash.com/photo-1566174053879-31528523f8c4',
    'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7',
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633',
    'https://images.unsplash.com/photo-1580682312385-e94d8de1cf3c',
    'https://images.unsplash.com/photo-1603252109303-2751441dd157'
  ],
  Home: [
    'https://images.unsplash.com/photo-1485955900006-10f4d324d411',
    'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb',
    'https://images.unsplash.com/photo-1520981825232-ece5fae45120',
    'https://images.unsplash.com/photo-1583845112239-97ef1341b271',
    'https://images.unsplash.com/photo-1574621100236-d25b64cfd647',
    'https://images.unsplash.com/photo-1609798264474-810186ad3d0e',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f',
    'https://images.unsplash.com/photo-1616046229478-9901c5536a45',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
    'https://images.unsplash.com/photo-1517705008128-361805f42e86',
    'https://images.unsplash.com/photo-1558882224-dda166733046',
    'https://images.unsplash.com/photo-1565183928294-7063f23ce0f8',
    'https://images.unsplash.com/photo-1550581190-9c1c48d21d6c',
    'https://images.unsplash.com/photo-1531889236320-35bcb7d1a5bf',
    'https://images.unsplash.com/photo-1583845112239-97ef1341b271'
  ],
  Accessories: [
    'https://images.unsplash.com/photo-1574871786514-46e2877de1c5',
    'https://images.unsplash.com/photo-1611923134957-038866b12e32',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90',
    'https://images.unsplash.com/photo-1559563458-527698bf5295',
    'https://images.unsplash.com/photo-1600721391776-b5cd0e0048f9',
    'https://images.unsplash.com/photo-1615655406736-b37c4fabf923',
    'https://images.unsplash.com/photo-1622560480605-d83c661ec8d7',
    'https://images.unsplash.com/photo-1603487742131-4160ec999306',
    'https://images.unsplash.com/photo-1609245340409-cad2474ab1d5',
    'https://images.unsplash.com/photo-1612902456551-acb0ec4462ea',
    'https://images.unsplash.com/photo-1635767798638-3e7e43d13f6d',
    'https://images.unsplash.com/photo-1589782182703-2aaa69037b5b',
    'https://images.unsplash.com/photo-1627123424574-724758594e93',
    'https://images.unsplash.com/photo-1611085583191-7fa1018c55b4',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a'
  ],
  Furniture: [
    'https://images.unsplash.com/photo-1580480055273-228ff5388ef8',
    'https://images.unsplash.com/photo-1554295405-abb8fd54f153',
    'https://images.unsplash.com/photo-1634712282287-14ed57b9cc89',
    'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
    'https://images.unsplash.com/photo-1540574163026-643ea20ade25',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com/photo-1538688423619-a81d3f23454b',
    'https://images.unsplash.com/photo-1567016432779-094069958ea5',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
    'https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a',
    'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe',
    'https://images.unsplash.com/photo-1617364852223-75f173a9b2e5',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7',
    'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e'
  ],
  Beauty: [
    'https://images.unsplash.com/photo-1571781926291-c477ebfd024b',
    'https://images.unsplash.com/photo-1591019479261-1a7ab156dea2',
    'https://images.unsplash.com/photo-1598662957563-ee4965d4d72c',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348',
    'https://images.unsplash.com/photo-1607602132700-068258431c6c',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e',
    'https://images.unsplash.com/photo-1570194065650-d68e7d136815',
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2',
    'https://images.unsplash.com/photo-1625772452859-1c03d5bf1137',
    'https://images.unsplash.com/photo-1617897903246-719242758950',
    'https://images.unsplash.com/photo-1629198735660-e39ea93f5c24',
    'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9',
    'https://images.unsplash.com/photo-1596178060810-72267cacedea',
    'https://images.unsplash.com/photo-1607652969504-fe0bfb9c040e',
    'https://images.unsplash.com/photo-1576426863848-c21f53c60b19'
  ],
  Sports: [
    'https://images.unsplash.com/photo-1517649763962-0c623066013b',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635',
    'https://images.unsplash.com/photo-1624067044750-83181c21bf8a',
    'https://images.unsplash.com/photo-1625934410176-15b1fb66c547',
    'https://images.unsplash.com/photo-1515523110800-9415d13b84a8',
    'https://images.unsplash.com/photo-1595078475328-1ab05d0a6a0e',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018',
    'https://images.unsplash.com/photo-1599058917212-d750089bc07e',
    'https://images.unsplash.com/photo-1593079831268-3381b0db4a77',
    'https://images.unsplash.com/photo-1558365849-6ebd8b0454b2',
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1',
    'https://images.unsplash.com/photo-1541534741688-7063f23ce0f8',
    'https://images.unsplash.com/photo-1518614368389-5160c0b0ccae'
  ],
  Books: [
    'https://images.unsplash.com/photo-1512820790803-83ca734da794',
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f',
    'https://images.unsplash.com/photo-1519682337058-a94d519337bc',
    'https://images.unsplash.com/photo-1516979187457-637abb4f9353',
    'https://images.unsplash.com/photo-1524578271613-d550eacf6090',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6',
    'https://images.unsplash.com/photo-1589998059171-988d887df646',
    'https://images.unsplash.com/photo-1553729459-efe14ef6055d',
    'https://images.unsplash.com/photo-1541963463532-d68292c34b19',
    'https://images.unsplash.com/photo-1543002588-bfa74002ed7e',
    'https://images.unsplash.com/photo-1532012197267-da84d127e765',
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
    'https://images.unsplash.com/photo-1583468982228-2832ef0ba41d',
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af',
    'https://images.unsplash.com/photo-1576872381149-7847515ce5d8'
  ],
  Toys: [
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7',
    'https://images.unsplash.com/photo-1618842676088-c4d48a6a7c9d',
    'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65',
    'https://images.unsplash.com/photo-1584822764834-4f5110ba6681',
    'https://images.unsplash.com/photo-1587654780291-39c9404d746b',
    'https://images.unsplash.com/photo-1545558014-8692077e9b5c',
    'https://images.unsplash.com/photo-1586769852836-bc069f19e1be',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088',
    'https://images.unsplash.com/photo-1555448248-2571daf6344b',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1',
    'https://images.unsplash.com/photo-1594745561149-2211ca8c5d98',
    'https://images.unsplash.com/photo-1611647832580-377268deb23d',
    'https://images.unsplash.com/photo-1581557991964-125469da3b8a',
    'https://images.unsplash.com/photo-1566140967404-b8b3932483f5',
    'https://images.unsplash.com/photo-1599623560574-39d485900c95'
  ],
  Automotive: [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
    'https://images.unsplash.com/photo-1537041373723-5e6a77e3d9bf',
    'https://images.unsplash.com/photo-1542014740373-51ad6425eb7c',
    'https://images.unsplash.com/photo-1600661653561-629509216228',
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d',
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c',
    'https://images.unsplash.com/photo-1547038577-da80abbc4f19',
    'https://images.unsplash.com/photo-1617814076367-b759c7d7e738',
    'https://images.unsplash.com/photo-1562911791-c7a97b729ec5',
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2',
    'https://images.unsplash.com/photo-1580273916550-e323be2ae537',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a',
    'https://images.unsplash.com/photo-1623013438264-d176fb91ee99',
    'https://images.unsplash.com/photo-1566473965997-3de9c817e938'
  ]
};

// Product names for different categories
const productNames = {
  Electronics: [
    'Premium Wireless Headphones', 'Smart Watch Series X', 'Ultra HD 4K TV', 'Portable Bluetooth Speaker',
    'Wireless Gaming Mouse', 'Professional DSLR Camera', 'Noise-Cancelling Earbuds', 'Smart Home Hub',
    'Gaming Laptop', 'Wireless Charging Pad', 'Mechanical Keyboard', 'Virtual Reality Headset',
    'Compact Drone', 'External SSD Drive', 'HD Webcam', 'Wireless Router', 'Smart Fitness Tracker',
    'Digital Drawing Tablet', 'Portable Power Bank', 'Foldable Smartphone', 'Wireless Earphones',
    'Smart Doorbell', 'Action Camera', 'Mini Projector', 'Gaming Console'
  ],
  Clothing: [
    'Organic Cotton T-Shirt', 'Designer Denim Jeans', 'Casual Linen Shirt', 'Knitted Wool Sweater',
    'Summer Maxi Dress', 'Tailored Blazer', 'Hooded Sweatshirt', 'Athletic Performance Shorts',
    'Waterproof Hiking Jacket', 'Formal Business Suit', 'Yoga Leggings', 'Graphic Print T-Shirt',
    'Winter Puffer Coat', 'Lightweight Running Jacket', 'Casual Chino Pants', 'Floral Summer Dress',
    'Slim Fit Polo Shirt', 'Vintage Leather Jacket', 'Striped Button-Down Shirt', 'Relaxed Fit Jeans',
    'Cotton Pajama Set', 'Wool Winter Coat', 'Thermal Underwear Set', 'Beach Cover-Up', 'Formal Evening Gown'
  ],
  Home: [
    'Ceramic Plant Pot', 'Scented Soy Candle', 'Decorative Throw Pillow', 'Egyptian Cotton Bed Sheets',
    'Smart LED Light Bulbs', 'Stainless Steel Cooking Pot', 'Luxury Bath Towel Set', 'Nonstick Baking Set',
    'Aromatherapy Diffuser', 'Premium Knife Set', 'Cast Iron Skillet', 'Luxury Duvet Cover',
    'Glass Food Storage Containers', 'Indoor Herb Garden Kit', 'Robot Vacuum Cleaner', 'Luxury Shower Curtain',
    'Air Purifier', 'Espresso Machine', 'Wall Art Canvas Print', 'Luxury Pillow Top Mattress',
    'Ceramic Dinner Set', 'Electric Pressure Cooker', 'Wool Area Rug', 'Crystal Wine Glasses', 'Smart Thermostat'
  ],
  Accessories: [
    'Designer Laptop Sleeve', 'Leather Wallet', 'Polarized Sunglasses', 'Sterling Silver Necklace',
    'Cashmere Scarf', 'Leather Belt', 'Designer Handbag', 'Minimalist Watch', 'Beaded Bracelet',
    'Silk Neck Tie', 'Leather Gloves', 'Statement Earrings', 'Vintage Brooch', 'Phone Case',
    'Digital Smartwatch', 'Wool Beanie Hat', 'Gold Plated Cufflinks', 'Leather Messenger Bag',
    'Passport Holder', 'Hair Accessories Set', 'Diamond Stud Earrings', 'Designer Backpack',
    'Silver Charm Bracelet', 'Luxury Pen Set', 'Designer Keychain'
  ],
  Furniture: [
    'Ergonomic Office Chair', 'Modern Coffee Table', 'Queen Size Platform Bed', 'Sectional Sofa',
    'Solid Wood Dining Table', 'Floating Wall Shelves', 'Reclining Armchair', 'Storage Ottoman',
    'Mid-Century Modern Desk', 'Velvet Upholstered Headboard', 'Wooden Bookcase', 'Marble Top Side Table',
    'L-Shaped Computer Desk', 'Bar Stool Set', 'Glass Display Cabinet', 'Rustic TV Stand',
    'Leather Recliner Sofa', 'King Size Adjustable Bed', 'Outdoor Patio Set', 'Compact Kitchen Island',
    'Wall-Mounted Desk', 'Console Table', 'Nursery Rocking Chair', 'Shoe Storage Cabinet', 'Corner Desk'
  ],
  Beauty: [
    'Vitamin C Serum', 'Organic Face Moisturizer', 'Natural Hair Conditioner', 'Vegan Lipstick Set',
    'Makeup Brush Collection', 'Dermatologist Approved Sunscreen', 'Anti-Aging Night Cream',
    'Volumizing Mascara', 'Exfoliating Face Scrub', 'Professional Hair Dryer', 'Organic Body Wash',
    'Vegan Nail Polish', 'Luxury Perfume', 'Hair Straightener', 'Facial Cleansing Brush',
    'Eye Shadow Palette', 'Beard Grooming Kit', 'Organic Body Lotion', 'Teeth Whitening Kit',
    'Eyelash Curler', 'Hair Growth Serum', 'Clay Face Mask', 'Hydrating Lip Balm',
    'Rechargeable Electric Toothbrush', 'Luxury Shaving Kit'
  ],
  Sports: [
    'Yoga Mat', 'Jump Rope', 'Adjustable Dumbbells', 'Running Shoes', 'Tennis Racket',
    'Basketball', 'Golf Club Set', 'Fitness Tracker', 'Exercise Resistance Bands',
    'Swimming Goggles', 'Hiking Backpack', 'Cycling Helmet', 'Soccer Ball', 'Camping Tent',
    'Treadmill', 'Fishing Rod', 'Ski Goggles', 'Indoor Exercise Bike', 'Boxing Gloves',
    'Badminton Set', 'Snowboard', 'Gymnastic Rings', 'Stand-Up Paddleboard', 'Rock Climbing Harness',
    'Pickleball Paddle Set'
  ],
  Books: [
    'Bestselling Fiction Novel', 'Self-Help Book', 'Cookbook', 'Historical Biography', 'Science Textbook',
    'Children\'s Picture Book', 'Travel Guide', 'Business Strategy Book', 'Poetry Collection',
    'Graphic Novel', 'Fantasy Series', 'Programming Tutorial', 'Motivational Book', 'Autobiography',
    'Art History Book', 'Scientific Journal', 'Mystery Thriller', 'Classic Literature', 'Philosophy Book',
    'Gardening Guide', 'Language Learning Book', 'World Atlas', 'Dystopian Novel', 'Investing Guide',
    'Personal Development Book'
  ],
  Toys: [
    'Building Blocks Set', 'Remote Control Car', 'Educational Puzzle', 'Plush Teddy Bear',
    'Interactive Robot Toy', 'Board Game', 'Art Supplies Kit', 'Dollhouse', 'Action Figure Set',
    'Musical Instrument Toy', 'Outdoor Play Set', 'Science Experiment Kit', 'Play Kitchen',
    'Wooden Train Set', 'Flying Drone', 'Superhero Costume', 'Magic Trick Set', 'Toy Workbench',
    'Dinosaur Figure Collection', 'Sensory Toy Set', 'STEM Building Kit', 'Electronic Pet',
    'Children\'s Play Tent', 'Musical Toy Piano', 'Water Blaster'
  ],
  Automotive: [
    'Car Phone Mount', 'Windshield Wiper Blades', 'LED Headlight Bulbs', 'Car Vacuum Cleaner',
    'Tire Pressure Gauge', 'Car Cover', 'Jumper Cables', 'Car Seat Covers', 'Dashboard Camera',
    'Portable Air Compressor', 'Car Wash Kit', 'Leather Seat Cleaner', 'Car Bluetooth Adapter',
    'Roof Cargo Carrier', 'GPS Navigation System', 'Emergency Road Kit', 'Car Battery Charger',
    'Interior LED Lights', 'Steering Wheel Cover', 'Window Tint Film', 'Car Floor Mats',
    'Oil Filter', 'Car Scratch Remover', 'Touchscreen Car Stereo', 'Car First Aid Kit'
  ]
};

const getProductDescription = (name, category) => {
  const descriptions = {
    Electronics: [
      `Experience top-quality sound with the ${name}. Featuring the latest technology for an immersive experience.`,
      `The cutting-edge ${name} combines modern design with powerful performance.`,
      `Stay connected and productive with the innovative ${name}, perfect for work and entertainment.`,
      `Elevate your tech collection with the premium ${name}, engineered for excellence.`
    ],
    Clothing: [
      `Look your best in the stylish ${name}, crafted from high-quality materials for comfort and durability.`,
      `The versatile ${name} transitions seamlessly from day to night, perfect for any occasion.`,
      `Upgrade your wardrobe with the fashionable ${name}, designed with attention to detail.`,
      `Experience ultimate comfort with the ${name}, featuring a modern fit and premium fabric.`
    ],
    Home: [
      `Transform your living space with the elegant ${name}, adding style and functionality to your home.`,
      `The beautiful ${name} adds a touch of sophistication to any room in your house.`,
      `Enhance your home decor with the stylish ${name}, combining form and function.`,
      `The premium ${name} is perfect for modern homes, adding both style and practicality.`
    ],
    Accessories: [
      `Complete your look with the sophisticated ${name}, designed to elevate any outfit.`,
      `Add a personal touch with the elegant ${name}, crafted with attention to detail.`,
      `The versatile ${name} is a must-have accessory for every collection.`,
      `Make a statement with the stylish ${name}, designed for the fashion-conscious individual.`
    ],
    Furniture: [
      `Upgrade your living space with the elegant ${name}, combining comfort and style.`,
      `The sturdy ${name} is built to last, providing both functionality and aesthetics.`,
      `Create a welcoming space with the beautiful ${name}, designed for modern living.`,
      `The premium ${name} adds sophistication to any room with its thoughtful design.`
    ],
    Beauty: [
      `Enhance your natural beauty with the effective ${name}, formulated with premium ingredients.`,
      `The luxurious ${name} is perfect for your daily beauty routine, leaving you looking radiant.`,
      `Transform your skincare regimen with the innovative ${name}, designed for all skin types.`,
      `Experience the difference with the high-quality ${name}, developed by beauty experts.`
    ],
    Sports: [
      `Enhance your performance with the professional-grade ${name}, designed for athletes.`,
      `Stay active with the durable ${name}, perfect for fitness enthusiasts of all levels.`,
      `The high-quality ${name} is essential for your training routine, built for performance.`,
      `Achieve your fitness goals with the reliable ${name}, engineered for optimal results.`
    ],
    Books: [
      `Expand your knowledge with the informative ${name}, written by experts in the field.`,
      `Immerse yourself in the captivating ${name}, a must-read for enthusiasts.`,
      `The acclaimed ${name} offers valuable insights and perspectives on important topics.`,
      `Discover new ideas and concepts with the thought-provoking ${name}.`
    ],
    Toys: [
      `Inspire creativity and fun with the engaging ${name}, perfect for children of all ages.`,
      `The educational ${name} combines learning and play for an enriching experience.`,
      `Encourage imaginative play with the interactive ${name}, designed for development.`,
      `The durable ${name} provides hours of entertainment and learning opportunities.`
    ],
    Automotive: [
      `Upgrade your vehicle with the essential ${name}, designed for performance and reliability.`,
      `The premium ${name} is a must-have for car enthusiasts, enhancing your driving experience.`,
      `Maintain your vehicle's condition with the high-quality ${name}, built to last.`,
      `The innovative ${name} adds convenience and functionality to your automotive needs.`
    ]
  };

  const categoryDescriptions = descriptions[category] || descriptions['Electronics'];
  return categoryDescriptions[Math.floor(Math.random() * categoryDescriptions.length)];
};

const getProductFeatures = (category) => {
  const features = {
    Electronics: [
      'High-Quality Audio', 'Long Battery Life', 'Portable Design', 'Wireless Connectivity',
      'High-Resolution Display', 'Fast Charging', 'Waterproof', 'Durable Construction'
    ],
    Clothing: [
      'Breathable Fabric', 'Moisture-Wicking', 'Four-Way Stretch', 'Quick Drying',
      'Soft and Comfortable', 'Relaxed Fit', 'Adjustable Waistband', 'Multiple Pockets'
    ],
    Home: [
      'Easy to Clean', 'Durable Construction', 'Space-Saving Design', 'Multi-Functional',
      'Ergonomic Design', 'Adjustable Height', 'Soft Close Drawers', 'High-Quality Materials'
    ],
    Accessories: [
      'Stylish Design', 'Durable Construction', 'Adjustable Strap', 'Multiple Compartments',
      'Water-Resistant', 'Easy to Clean', 'Compact Size', 'High-Quality Materials'
    ],
    Furniture: [
      'Sturdy Construction', 'Comfortable Seating', 'Adjustable Height', 'Durable Materials',
      'Easy to Assemble', 'Space-Saving Design', 'Multi-Functional', 'High-Quality Finishing'
    ],
    Beauty: [
      'Natural Ingredients', 'Cruelty-Free', 'Vegan-Friendly', 'Hypoallergenic',
      'Non-Comedogenic', 'Fragrance-Free', 'Dermatologist Tested', 'Clinically Proven'
    ],
    Sports: [
      'Durable Construction', 'Water-Resistant', 'Adjustable Strap', 'Multiple Compartments',
      'Breathable Fabric', 'Moisture-Wicking', 'Four-Way Stretch', 'Quick Drying'
    ],
    Books: [
      'Informative Content', 'Engaging Storyline', 'High-Quality Paper', 'Durable Binding',
      'Colorful Illustrations', 'Easy to Understand', 'Relatable Characters', 'Well-Researched'
    ],
    Toys: [
      'Durable Construction', 'Easy to Clean', 'Non-Toxic Materials', 'Colorful Design',
      'Educational Value', 'Promotes Creativity', 'Develops Motor Skills', 'Encourages Imagination'
    ],
    Automotive: [
      'Durable Construction', 'Easy to Install', 'High-Quality Materials', 'Water-Resistant',
      'Adjustable Design', 'Multiple Functions', 'Compact Size', 'Heavy-Duty'
    ]
  };

  const categoryFeatures = features[category] || features['Electronics'];
  return categoryFeatures;
};

const getProductSpecifications = (category) => {
  const specs = {
    Electronics: {
      brand: ['SoundMaster', 'TechGear', 'EliteSound', 'ProTech', 'NextGen'],
      connectivity: ['Bluetooth 5.0', 'WiFi 6', 'USB-C', 'HDMI 2.1'],
      batteryLife: ['20 hours', '24 hours', '30 hours', '48 hours'],
      warranty: ['1 year', '2 years', '3 years']
    },
    Clothing: {
      material: ['100% Cotton', 'Organic Cotton', 'Polyester', 'Cotton Blend', 'Wool', 'Linen'],
      size: ['S, M, L, XL', 'XS to XXL', 'Standard Sizes', 'Plus Sizes Available'],
      care: ['Machine Washable', 'Dry Clean Only', 'Hand Wash Cold'],
      origin: ['Imported', 'Made in USA', 'Ethically Manufactured']
    },
    Home: {
      material: ['Ceramic', 'Glass', 'Wood', 'Metal', 'Cotton', 'Linen'],
      dimensions: ['Small', 'Medium', 'Large', 'Various Sizes Available'],
      care: ['Dishwasher Safe', 'Hand Wash Only', 'Machine Washable'],
      features: ['BPA-Free', 'Eco-Friendly', 'Handcrafted', 'Multipurpose']
    },
    Accessories: {
      material: ['Leather', 'Sterling Silver', 'Gold Plated', 'Stainless Steel', 'Canvas'],
      size: ['One Size', 'Adjustable', 'Multiple Sizes Available'],
      style: ['Modern', 'Classic', 'Vintage', 'Minimalist'],
      warranty: ['1 year', '2 years', 'Lifetime']
    },
    Furniture: {
      material: ['Solid Wood', 'MDF', 'Metal', 'Glass', 'Leather', 'Fabric'],
      dimensions: ['See Product Description', 'Customizable', 'Standard Size'],
      assembly: ['Assembly Required', 'Pre-Assembled', 'Partial Assembly'],
      warranty: ['1 year', '5 years', '10 years']
    },
    Beauty: {
      ingredients: ['Natural', 'Organic', 'Vegan', 'Cruelty-Free', 'Hypoallergenic'],
      skinType: ['All Skin Types', 'Sensitive', 'Oily', 'Dry', 'Combination'],
      volume: ['30ml', '50ml', '100ml', '200ml'],
      certification: ['Dermatologist Tested', 'Allergy Tested', 'Clinically Proven']
    },
    Sports: {
      material: ['Nylon', 'Polyester', 'Spandex', 'Rubber', 'Metal', 'Composite'],
      size: ['Small', 'Medium', 'Large', 'One Size Fits All'],
      features: ['Waterproof', 'Adjustable', 'Portable', 'Foldable'],
      recommended: ['Beginners', 'Intermediate', 'Professional', 'All Levels']
    },
    Books: {
      format: ['Hardcover', 'Paperback', 'E-Book', 'Audiobook'],
      pages: ['Under 200', '200-400', 'Over 400'],
      language: ['English', 'Spanish', 'French', 'German', 'Multiple Languages'],
      audience: ['Children', 'Young Adult', 'Adult', 'All Ages']
    },
    Toys: {
      ageRange: ['0-2 years', '3-5 years', '6-8 years', '9-12 years', '13+ years'],
      material: ['Plastic', 'Wood', 'Plush', 'Metal', 'Eco-friendly'],
      batteries: ['Required (Not Included)', 'Required (Included)', 'Not Required'],
      educational: ['STEM Learning', 'Creative Play', 'Motor Skills', 'Problem Solving']
    },
    Automotive: {
      compatibility: ['Universal Fit', 'Model Specific', 'Check Description'],
      material: ['Plastic', 'Metal', 'Rubber', 'Leather', 'Microfiber'],
      installation: ['DIY Installation', 'Professional Installation Recommended', 'Plug and Play'],
      warranty: ['1 year', '2 years', '5 years', 'Limited Lifetime']
    }
  };

  const categorySpecs = specs[category] || specs['Electronics'];
  const result = {};
  
  // Select random specifications for each category
  Object.keys(categorySpecs).forEach(specKey => {
    const specValues = categorySpecs[specKey];
    result[specKey] = specValues[Math.floor(Math.random() * specValues.length)];
  });
  
  return result;
};

// Generate a large number of products
const createProducts = (categoryMap) => {
  const products = [];
  const totalProducts = 220; // At least 200 products
  
  // Calculate how many products to create per category
  const productsPerCategory = Math.ceil(totalProducts / categories.length);
  
  categories.forEach(category => {
    const categoryId = categoryMap.get(category.name);
    const catImages = productImages[category.name] || productImages['Electronics'];
    const catNames = productNames[category.name] || productNames['Electronics'];
    
    // Create multiple products for each category
    for (let i = 0; i < productsPerCategory; i++) {
      // Pick a random name from the category's product names
      const nameIndex = i % catNames.length;
      const name = catNames[nameIndex];
      
      // Generate a random price between $9.99 and $1999.99
      const price = Math.round((Math.random() * 1990 + 9.99) * 100) / 100;
      
      // Pick a random image from the category's product images
      const imageIndex = i % catImages.length;
      const image = catImages[imageIndex];
      
      // Generate random specifications
      const specs = getProductSpecifications(category.name);
      const specsMap = new Map();
      Object.keys(specs).forEach(key => {
        specsMap.set(key, specs[key]);
      });
      
      // Create product object
      const product = {
        name: name,
        description: getProductDescription(name, category.name),
        price: price,
        images: [image],
        category: categoryId,
        stock: Math.floor(Math.random() * 100) + 1, // Random stock between 1 and 100
        featured: Math.random() < 0.2, // 20% chance of being featured
        rating: Math.round((Math.random() * 4 + 1) * 10) / 10, // Random rating between 1.0 and 5.0
        numReviews: Math.floor(Math.random() * 50), // Random number of reviews between 0 and 49
        reviews: [],
        features: getProductFeatures(category.name),
        specifications: specsMap,
        sku: `${category.name.substring(0, 2).toUpperCase()}-${nameIndex.toString().padStart(3, '0')}-${Math.floor(Math.random() * 10000)}`,
        discountPercentage: Math.random() < 0.3 ? Math.floor(Math.random() * 40) + 5 : 0, // 30% chance of having a discount between 5% and 45%
        tags: [category.name.toLowerCase(), ...name.toLowerCase().split(' ')]
      };
      
      products.push(product);
    }
  });
  
  return products;
};

// Clear database and add new data
const importData = async () => {
  try {
    // Clear previous data
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    
    console.log('Previous data cleared');
    
    // Create users
    const hashedUsers = await Promise.all(
      users.map(async (user) => {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
        return user;
      })
    );
    
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`${createdUsers.length} users created`);
    
    // Create categories
    const createdCategories = await Category.insertMany(categories);
    console.log(`${createdCategories.length} categories created`);
    
    // Map category names to IDs for product creation
    const categoryMap = new Map();
    createdCategories.forEach(category => {
      categoryMap.set(category.name, category._id);
    });
    
    // Create products
    const products = createProducts(categoryMap);
    await Product.insertMany(products);
    console.log(`${products.length} products created`);
    
    console.log('Data import complete!');
    process.exit();
  } catch (error) {
    console.error(`Error importing data: ${error.message}`);
    process.exit(1);
  }
};

// Execute the seed
importData();