const Product = require('../models/product.model');
const Category = require('../models/category.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');

// Helper: escape regex special characters to prevent ReDoS
function escapeRegex(str) {
 return str.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}

// In-memory request tracking (resets on server restart)
const productRequestTracker = {};
const unavailableRequests = []; // Admin alert queue

// Friendly personality helpers
const greetings = [
"Hey there! Great to see you! Welcome to Bazaar — your favorite online shopping destination!",
"Hello, hello! Welcome to Bazaar! I'm SO happy you're here!",
"Hi there, friend! Ready to find something amazing at Bazaar today?",
"Hey! Welcome back to Bazaar! What can I help you discover?",
"Hello, sunshine! I'm your Bazaar shopping buddy — let's find you something wonderful!",
"Hi! Welcome to Bazaar! Think of me as your personal shopping assistant — I'm here to make your day!",
"Hey friend! So glad you stopped by Bazaar! What are we shopping for today?"
];

const thankResponses = [
"You're SO welcome! Happy shopping, and remember — I'm always here if you need me!",
"Aww, glad I could help! Don't hesitate to come back anytime!",
"No problem at all, friend! It's my absolute pleasure to help you!",
"Anytime! That's what I'm here for! Enjoy your Bazaar experience!",
"My pleasure! Shopping should be fun, and I love being part of your journey!",
"You're welcome! Seriously though, I'm here 24/7 — never hesitate to ask anything!"
];

const notFoundSofteners = [
"Hmm, I couldn't quite find that one, but don't worry — let me help another way!",
"I looked high and low but no luck on that one — want me to suggest something similar?",
"That's a tricky one — I'm not seeing a match right now. But I've got plenty of other great options!",
"I couldn't find that specific item, but our catalog is huge — let's try a different search!"
];

const encouragements = [
"You've got great taste, by the way!",
"Love what you're looking at!",
"Excellent choice — you clearly know quality!",
"Ooh, good pick!"
];

const farewells = [
"Goodbye, friend! Come back and chat anytime — I'll be right here!",
"See you later! It was lovely chatting with you. Happy shopping!",
"Bye for now! Remember, I'm always just a message away!",
"Take care! Hope you found what you were looking for. See you soon!",
"Catch you later! Have an amazing day ahead!"
];

function pickRandom(arr) {
 return arr[Math.floor(Math.random() * arr.length)];
}

// Track product requests for analytics
function trackRequest(query, found, userId) {
 const key = (query ||'').toLowerCase().trim();
 if (!key) return;
 if (!productRequestTracker[key]) {
 productRequestTracker[key] = { count: 0, lastRequested: null, foundResults: false };
 }
 productRequestTracker[key].count += 1;
 productRequestTracker[key].lastRequested = new Date();
 productRequestTracker[key].foundResults = found;

 // If product not found, add to admin alert queue
 if (!found) {
 unavailableRequests.push({
 query: key,
 userId: userId ||'anonymous',
 timestamp: new Date()
 });
 // Keep only last 100 alerts
 if (unavailableRequests.length > 100) unavailableRequests.shift();
 }
}

// Process chat messages and provide intelligent responses
exports.processMessage = async (req, res, next) => {
 try {
 const { message } = req.body;
 const user = req.user; // Access the authenticated user
 
 if (!message) {
 return res.status(400).json({ message:'Message is required'});
 }
 
 // Determine user intent and extract key information
 const intent = determineIntent(message);
 
 let response;
 let data = null;
 
 // Enhanced access for admin users
 const isAdmin = user && user.role ==='admin';
 
 // Handle different intents
 switch (intent.type) {
 case'product_search':
 data = await handleProductSearch(intent.params, isAdmin);
 trackRequest(intent.params.search, data && data.products && data.products.length > 0, user?._id);
 response = formatProductSearchResponse(data, intent);
 break;
 
 case'product_details':
 data = await handleProductDetails(intent.params, isAdmin);
 trackRequest(intent.params.search, !!data, user?._id);
 response = formatProductDetailsResponse(data);
 break;
 
 case'category_inquiry':
 data = await handleCategoryInquiry(isAdmin);
 response = formatCategoryResponse(data);
 break;
 
 case'price_inquiry':
 data = await handlePriceInquiry(intent.params, isAdmin);
 trackRequest(intent.params.search, !!data, user?._id);
 response = formatPriceResponse(data);
 break;
 
 case'stock_inquiry':
 data = await handleStockInquiry(intent.params, isAdmin);
 trackRequest(intent.params.search, !!data, user?._id);
 response = formatStockResponse(data);
 break;
 
 case'recommendation':
 data = await handleRecommendation(intent.params, isAdmin);
 response = formatRecommendationResponse(data);
 break;

 case'deals':
 data = await handleDeals(isAdmin);
 response = formatDealsResponse(data);
 break;

 case'popular':
 data = await handlePopular(isAdmin);
 response = formatPopularResponse(data);
 break;

 case'new_arrivals':
 data = await handleNewArrivals(isAdmin);
 response = formatNewArrivalsResponse(data);
 break;

 case'track_order':
 response ="Great question! You can track your orders super easily! Just head to **Profile → Orders** and you'll see real-time status updates for all your purchases. If you have a specific order number, feel free to share it and I'll do my best to help!";
 break;

 // Admin-specific quick actions
 case'inventory_status':
 if (isAdmin) {
 data = await handleInventoryStatus();
 response = formatInventoryResponse(data);
 } else {
 response ="I'm sorry, inventory details are only available to administrators.";
 }
 break;

 case'recent_orders':
 if (isAdmin) {
 data = await handleRecentOrders();
 response = formatRecentOrdersResponse(data);
 } else {
 response ="You can view your personal orders on the Orders page!";
 }
 break;

 case'low_stock':
 if (isAdmin) {
 data = await handleLowStock();
 response = formatLowStockResponse(data);
 } else {
 response ="Sorry, that information is only available to store administrators.";
 }
 break;

 case'customer_accounts':
 if (isAdmin) {
 data = await handleCustomerAccounts();
 response = formatCustomerAccountsResponse(data);
 } else {
 response ="Account management is available to administrators only.";
 }
 break;

 case'unavailable_alerts':
 if (isAdmin) {
 data = { alerts: unavailableRequests.slice(-20), tracker: productRequestTracker };
 response = formatUnavailableAlertsResponse(data);
 } else {
 response ="That information is only available to administrators.";
 }
 break;
 
 case'greeting':
 if (isAdmin) {
 const pendingAlerts = unavailableRequests.length;
 const alertNote = pendingAlerts > 0 
? ` Oh, heads up — there are ${pendingAlerts} product requests from customers for items we don't carry yet! Ask me about"unavailable alerts"to see them.`
 :'Everything looks great on the customer request front!';
 response = `${pickRandom(greetings)} As an admin, I'm your command center! I can show you real-time inventory, orders, customer data, and so much more.${alertNote}`;
 } else {
 response = `${pickRandom(greetings)} I can help you find products, check prices, get personalized recommendations, track orders, learn about our policies, and SO much more! Just ask me anything! `;
 }
 break;
 
 case'thanks':
 response = pickRandom(thankResponses);
 break;

 case'farewell':
 response = pickRandom(farewells);
 break;

 case'shipping_policy':
 response ="**Shipping at Bazaar — We've Got You Covered!**\n\n"+
"• **Standard Shipping**: 5-7 business days — FREE on orders over $50!\n"+
"• **Express Shipping**: 2-3 business days — just $9.99\n"+
"• **Overnight Shipping**: Next business day — $19.99\n\n"+
"We ship to all 50 US states, and international shipping is available to select countries!"+
"You'll get a tracking number via email as soon as your order ships."+
"Have any specific shipping questions? I'm all ears!";
 break;

 case'return_policy':
 response ="**Bazaar's Return Policy — Hassle-Free, Promise!**\n\n"+
"• **30-Day Returns**: Changed your mind? No worries! Return within 30 days for a full refund.\n"+
"• **Condition**: Items must be unused, in original packaging with tags attached.\n"+
"• **Free Returns**: We provide a prepaid return label — no cost to you!\n"+
"• **Refund Timeline**: Once we receive your return, refunds process in 3-5 business days.\n"+
"• **Exchanges**: Want a different size or color? We'll happily swap it out!\n\n"+
"We want you to LOVE what you buy. If not, we'll make it right!";
 break;

 case'payment_info':
 response ="**Payment Options at Bazaar**\n\n"+
"We accept all major payment methods to make checkout a breeze:\n"+
"• Visa, Mastercard, American Express, Discover\n"+
"• Digital wallets (Apple Pay, Google Pay)\n"+
"• Bazaar Gift Cards\n\n"+
"**Security**: All transactions are encrypted with industry-standard SSL. Your payment info is NEVER stored on our servers.\n\n"+
"Shopping worry-free is what we're all about! Have a payment question? Just ask!";
 break;

 case'about_us':
 response ="**About Bazaar — Our Story**\n\n"+
"Bazaar is your one-stop online marketplace bringing you quality products from around the world! \n\n"+
"**Our Mission**: To make premium shopping accessible, affordable, and absolutely delightful for everyone.\n\n"+
"**What We Offer**: 200+ carefully curated products across 10+ categories — from cutting-edge electronics to trendy fashion, beautiful home decor, and so much more!\n\n"+
"**Our Values**:\n"+
"• Quality first — every product is vetted\n"+
"• Fair prices — no markup madness\n"+
"• Customer love — you're not a number, you're family\n"+
"• Sustainability — we care about the planet\n\n"+
"We're not just a store — we're a community. And we're SO glad you're part of it!";
 break;

 case'contact_info':
 response ="**Get in Touch with Bazaar!**\n\n"+
"We LOVE hearing from you! Here's how to reach us:\n\n"+
"• **Email**: support@bazaar.com\n"+
"• **Phone**: 1-800-BAZAAR-1 (1-800-229-2271)\n"+
"• **Live Chat**: You're already using it! I'm here 24/7! \n"+
"• **Headquarters**: San Francisco, CA\n\n"+
"**Response Times**:\n"+
"• Chat: Instant (that's me! )\n"+
"• Email: Within 24 hours\n"+
"• Phone: Mon-Fri, 9 AM - 6 PM PST\n\n"+
"Don't be a stranger — we genuinely want to help!";
 break;

 case'hours':
 response ="**Bazaar Operating Hours**\n\n"+
"The BEST part? **Our online store is open 24/7!** Shop anytime, anywhere!\n\n"+
"**Customer Support Hours**:\n"+
"• Chat Bot (me!): 24/7 — I never sleep! \n"+
"• Email Support: Responses within 24 hours\n"+
"• Phone Support: Monday - Friday, 9 AM - 6 PM PST\n"+
"• Weekends: Email only, responses by Monday\n\n"+
"So whether it's 3 AM or 3 PM, you can always shop and I'm always here to help!";
 break;

 case'size_guide':
 response ="**Bazaar Size Guide**\n\n"+
"Finding the right fit is SO important! Here's how we help:\n\n"+
"• Each clothing item has a **detailed size chart** on its product page\n"+
"• We use **standard US sizing** across all brands\n"+
"• **Pro tip**: Check the measurements in inches/cm for the most accurate fit!\n\n"+
"**Quick Reference (Tops)**:\n"+
"• XS: Chest 32-34\"| S: 34-36\"| M: 36-38\"\n"+
"• L: 38-40\"| XL: 40-42\"| XXL: 42-44\"\n\n"+
"Still unsure? Order two sizes and return the one that doesn't fit — returns are FREE! 🆓"+
"Want me to find products in a specific size?";
 break;

 case'gift_cards':
 response ="**Bazaar Gift Cards — The Perfect Present!**\n\n"+
"Can't decide what to gift? A Bazaar Gift Card is ALWAYS the right choice!\n\n"+
"• **Available amounts**: $10, $25, $50, $100, $250\n"+
"• **Delivery**: Instant via email — perfect for last-minute gifting! \n"+
"• **No expiration**: They're good forever!\n"+
"• **Redeemable**: On ANY product in our entire catalog\n\n"+
"Because the best gift is letting someone pick exactly what they love!";
 break;

 case'promotions':
 response ="**Current Bazaar Promotions & Deals!**\n\n"+
"Here's what's HOT right now:\n\n"+
"• **Free Shipping**: On all orders over $50!\n"+
"• 🆕 **New Customer**: Sign up and get 10% off your first order!\n"+
"• **Newsletter**: Subscribe for exclusive deals & early access to sales\n"+
"• **Seasonal Sales**: Keep an eye out — we have amazing seasonal events!\n\n"+
"Want to see our current deals and discounted products? Just ask me to \"show deals\"!";
 data = await handleDeals(isAdmin);
 break;

 case'loyalty':
 response ="**Bazaar Rewards Program**\n\n"+
"Great news — loyalty literally pays off at Bazaar! \n\n"+
"• **Earn Points**: 1 point for every $1 spent\n"+
"• **100 Points** = $5 reward certificate\n"+
"• **Birthday Bonus**: 2x points during your birthday month! \n"+
"• **VIP Tiers**: Bronze → Silver → Gold → Platinum\n"+
"• **Platinum Perks**: Free express shipping, early sale access, exclusive products!\n\n"+
"Just create an account and you're automatically enrolled. It's that easy!";
 break;

 case'delivery_time':
 response ="**Delivery Timeframes at Bazaar**\n\n"+
"Here's when you can expect your goodies:\n\n"+
"• **Standard**: 5-7 business days (FREE over $50!)\n"+
"• **Express**: 2-3 business days ($9.99)\n"+
"• **Overnight**: Next business day ($19.99)\n"+
"• **International**: 10-15 business days (varies by destination)\n\n"+
"**Order Processing**: Orders placed before 2 PM PST ship same day!\n\n"+
"We'll send you tracking info the moment your order leaves our warehouse. Can't wait for you to get your goodies!";
 break;

 case'help':
 response ="🆘 **How Can I Help You Today?**\n\n"+
"I can assist you with SO many things! Here's a quick guide:\n\n"+
"**Shopping**: Search products, get recommendations, check prices & stock\n"+
"**Browse**: Explore categories, new arrivals, deals & popular items\n"+
"**Orders**: Track orders, check delivery status\n"+
"**Returns**: Learn about our return & exchange policy\n"+
"**Shipping**: Delivery times, shipping costs, international shipping\n"+
"**Payment**: Accepted methods, security info\n"+
"**Sizing**: Size guides & measurement help\n"+
"**Gifts**: Gift cards & wrapping options\n"+
"**About Us**: Our story, contact info, and more\n\n"+
"Just type your question naturally and I'll do my best to help! Or use the quick action buttons below!";
 break;

 case'compliment':
 response = pickRandom([
"Aww, you're making me blush! Thank you so much! I love helping you!",
"That's SO kind of you! You just made my day! Is there anything else I can help with?",
"You're too sweet! I'm just doing my job, but comments like yours make it all worthwhile!",
"Thank you! You're pretty awesome yourself! Now, what else can I help you find?",
"That means the world to me! I'm here to make your Bazaar experience amazing!"
 ]);
 break;

 case'joke':
 response = pickRandom([
"Why did the shopping cart go to therapy? Because it had too many items to process!",
"What's a shopper's favorite type of music? Cart-ney Spears!",
"Why don't products ever win at poker? Because they always show their best deals! 🃏",
"I tried to write a joke about free shipping, but there was no delivery!",
"What did one shopping bag say to the other?'You're carrying a lot of weight!'",
"Why did the credit card break up with the wallet? They had too many charges between them!"
 ]);
 break;

 case'order_help':
 response ="**Order Help & FAQ**\n\n"+
"Here are answers to the most common order questions:\n\n"+
"**Q: How do I place an order?**\n"+
"A: Browse products → Add to cart → Checkout → Enter shipping & payment → Confirm! \n\n"+
"**Q: Can I modify my order?**\n"+
"A: If your order hasn't shipped yet, contact us ASAP and we'll try to make changes! \n\n"+
"**Q: My order is late. What do I do?**\n"+
"A: Check your tracking number first. If it seems stuck, email support@bazaar.com and we'll investigate immediately! \n\n"+
"**Q: Can I cancel my order?**\n"+
"A: Yes! Orders can be cancelled before they ship. Just go to Profile → Orders → Cancel. \n\n"+
"Need more specific help? I'm all ears!";
 break;

 case'account_help':
 response ="**Account Help**\n\n"+
"Here's everything you need to know about your Bazaar account:\n\n"+
"• **Create Account**: Click'Register'in the top navigation bar\n"+
"• **Login**: Click'Login'and enter your email & password\n"+
"• **Reset Password**: On the login page, click'Forgot Password'\n"+
"• **Update Profile**: Go to your Profile page to edit name, email, etc.\n"+
"• **Order History**: Profile → Orders shows all your past and current orders\n\n"+
"Having trouble with your account? Let me know the specific issue and I'll guide you through it!";
 break;

 case'security':
 response ="**Security at Bazaar — Your Safety is Our Priority!**\n\n"+
"We take your security VERY seriously:\n\n"+
"• **SSL Encryption**: All data is encrypted in transit\n"+
"• **Secure Payments**: PCI-compliant payment processing\n"+
"• **No Card Storage**: We NEVER store your full card details\n"+
"• **Firebase Auth**: Industry-leading authentication by Google\n"+
"• **Password Protection**: Strong hashing & salting\n"+
"• **Privacy**: We never sell your personal data. Period. \n\n"+
"Shop with confidence — you're in safe hands!";
 break;

 case'sustainability':
 response ="**Bazaar's Sustainability Commitment**\n\n"+
"We believe great shopping and caring for the planet go hand in hand! \n\n"+
"• **Eco-Packaging**: We use recyclable and biodegradable packaging materials\n"+
"• **Carbon Offsets**: We offset shipping emissions for every order\n"+
"• **Ethical Sourcing**: We work with suppliers who share our values\n"+
"• **Digital Receipts**: No paper waste — everything is digital\n"+
"• **Quality Over Quantity**: We curate durable products that last\n\n"+
"Together, we can shop responsibly! Thank you for being part of the change!";
 break;

 case'careers':
 response ="**Join the Bazaar Team!**\n\n"+
"We're always looking for passionate people to join our growing family! \n\n"+
"**Current Openings**:\n"+
"• Software Engineers (Full-stack, Frontend, Backend)\n"+
"• UX/UI Designers\n"+
"• Customer Experience Specialists\n"+
"• Product Managers\n"+
"• Marketing & Content Creators\n\n"+
"**Perks**: Remote-friendly, competitive pay, learning budget, stock options, and an amazing team! \n\n"+
"Check out our Careers page for details, or email careers@bazaar.com with your resume! We'd love to hear from you!";
 break;
 
 default:
 // Ultra-friendly fallback for unknown intents
 response = pickRandom([
"Hmm, I'm not 100% sure I understood that, but I'm eager to help! Could you rephrase, or try asking about products, shipping, returns, deals, or anything Bazaar-related? You can also use the quick action buttons below!",
"Ooh, that's an interesting question! I might not have the perfect answer for that one, but I can definitely help with shopping, orders, policies, recommendations, and more! What would you like to know?",
"I want to help SO badly, but I'm not sure I got that right! Try asking me about products, categories, deals, shipping, returns, or any Bazaar question — I'm great at those!",
"Great question! I'm still learning, but here's what I'm REALLY good at: finding products, showing deals, explaining policies, tracking orders, and being your shopping bestie! How can I help?",
"I appreciate you chatting with me! I couldn't match that to something I know, but don't give up on me! Ask about products, prices, shipping, returns, or use the quick action buttons for popular topics!"
 ]);
 }
 
 res.status(200).json({
 success: true,
 response,
 data,
 intent: intent.type
 });
 } catch (error) {
 next(error);
 }
};

// Determine the user's intent from their message
function determineIntent(message) {
 const lowerMessage = message.toLowerCase();
 
 // Check for product search intent
 if (
 lowerMessage.includes('find') || 
 lowerMessage.includes('search') || 
 lowerMessage.includes('looking for') ||
 lowerMessage.includes('do you have') ||
 lowerMessage.includes('show me')
 ) {
 // Extract product characteristics
 const params = {};
 
 // Look for category mentions
 const categoryMatch = lowerMessage.match(/in ([a-z\s]+)/i);
 if (categoryMatch) params.category = categoryMatch[1].trim();
 
 // Look for price mentions
 const priceMatch = lowerMessage.match(/(under|less than|cheaper than) \$([\d]+)/i);
 if (priceMatch) params.maxPrice = Number(priceMatch[2]);
 
 const minPriceMatch = lowerMessage.match(/(over|more than|above) \$([\d]+)/i);
 if (minPriceMatch) params.minPrice = Number(minPriceMatch[2]);
 
 // Extract product name/type
 let product ='';
 if (lowerMessage.includes('looking for')) {
 const match = lowerMessage.match(/looking for ([a-z\s]+)/i);
 if (match) product = match[1].trim();
 } else if (lowerMessage.includes('find')) {
 const match = lowerMessage.match(/find ([a-z\s]+)/i);
 if (match) product = match[1].trim();
 } else if (lowerMessage.includes('search')) {
 const match = lowerMessage.match(/search ([a-z\s]+)/i);
 if (match) product = match[1].trim();
 } else if (lowerMessage.includes('show me')) {
 const match = lowerMessage.match(/show me ([a-z\s]+)/i);
 if (match) product = match[1].trim();
 } else {
 // Use the whole message as a search term
 product = message;
 }
 
 params.search = product;
 return { type:'product_search', params };
 }
 
 // Check for product detail intent
 if (
 lowerMessage.includes('tell me about') ||
 lowerMessage.includes('details of') ||
 lowerMessage.includes('more about') ||
 lowerMessage.includes('describe') ||
 lowerMessage.includes('what is')
 ) {
 let product ='';
 const match = lowerMessage.match(/(tell me about|details of|more about|describe|what is) ([a-z\s]+)/i);
 if (match) product = match[2].trim();
 
 return { 
 type:'product_details', 
 params: { search: product } 
 };
 }
 
 // Check for category inquiry
 if (
 lowerMessage.includes('category') ||
 lowerMessage.includes('categories') ||
 lowerMessage.includes('department')
 ) {
 return { type:'category_inquiry', params: {} };
 }
 
 // Check for price inquiry
 if (
 lowerMessage.includes('how much') ||
 lowerMessage.includes('price') ||
 lowerMessage.includes('cost') ||
 lowerMessage.includes('expensive')
 ) {
 let product ='';
 const match = lowerMessage.match(/(how much|price|cost) (of|for|is) ([a-z\s]+)/i);
 if (match) product = match[3].trim();
 
 return { 
 type:'price_inquiry', 
 params: { search: product } 
 };
 }
 
 // Check for stock inquiry
 if (
 lowerMessage.includes('in stock') ||
 lowerMessage.includes('available') ||
 lowerMessage.includes('sold out')
 ) {
 let product ='';
 const match = lowerMessage.match(/(is|are) ([a-z\s]+) (in stock|available)/i);
 if (match) product = match[2].trim();
 
 return { 
 type:'stock_inquiry', 
 params: { search: product } 
 };
 }
 
 // Check for recommendation
 if (
 lowerMessage.includes('recommend') ||
 lowerMessage.includes('suggestion') ||
 lowerMessage.includes('what should i') ||
 lowerMessage.includes('best')
 ) {
 const params = {};
 
 if (lowerMessage.includes('under')) {
 const match = lowerMessage.match(/under \$([\d]+)/i);
 if (match) params.maxPrice = Number(match[1]);
 }
 
 // Extract product category
 let category ='';
 if (lowerMessage.includes('recommend')) {
 const match = lowerMessage.match(/recommend ([a-z\s]+)/i);
 if (match) category = match[1].trim();
 }
 
 params.category = category;
 return { type:'recommendation', params };
 }
 
 // Check for greeting
 if (
 /^(hello|hi|hey|greetings|howdy|sup|yo|what'?s up|good (morning|afternoon|evening))/.test(lowerMessage) ||
 lowerMessage ==='hi'|| lowerMessage ==='hey'|| lowerMessage ==='hello'
 ) {
 return { type:'greeting', params: {} };
 }
 
 // Check for farewell
 if (
 lowerMessage.includes('bye') ||
 lowerMessage.includes('goodbye') ||
 lowerMessage.includes('see you') ||
 lowerMessage.includes('take care') ||
 lowerMessage.includes('later') ||
 lowerMessage.includes('gotta go') ||
 lowerMessage.includes('good night')
 ) {
 return { type:'farewell', params: {} };
 }
 
 // Check for thanks
 if (
 lowerMessage.includes('thank') ||
 lowerMessage.includes('thanks') ||
 lowerMessage.includes('appreciate') ||
 lowerMessage.includes('helpful') ||
 lowerMessage.includes('cheers')
 ) {
 return { type:'thanks', params: {} };
 }

 // Check for compliment
 if (
 lowerMessage.includes('you\'re great') ||
 lowerMessage.includes('you\'re awesome') ||
 lowerMessage.includes('good job') ||
 lowerMessage.includes('well done') ||
 lowerMessage.includes('nice job') ||
 lowerMessage.includes('love you') ||
 lowerMessage.includes('amazing bot') ||
 lowerMessage.includes('you rock') ||
 lowerMessage.includes('best bot') ||
 lowerMessage.includes('great bot') ||
 lowerMessage.includes('smart bot') ||
 lowerMessage.includes('you\'re the best')
 ) {
 return { type:'compliment', params: {} };
 }

 // Check for joke request
 if (
 lowerMessage.includes('joke') ||
 lowerMessage.includes('funny') ||
 lowerMessage.includes('make me laugh') ||
 lowerMessage.includes('tell me something fun')
 ) {
 return { type:'joke', params: {} };
 }

 // Check for shipping policy
 if (
 lowerMessage.includes('shipping') ||
 lowerMessage.includes('delivery') ||
 lowerMessage.includes('ship') ||
 lowerMessage.includes('deliver') ||
 (lowerMessage.includes('how long') && (lowerMessage.includes('arrive') || lowerMessage.includes('get here') || lowerMessage.includes('take')))
 ) {
 // More specific: if asking about timeframes
 if (
 lowerMessage.includes('how long') ||
 lowerMessage.includes('how fast') ||
 lowerMessage.includes('when will') ||
 lowerMessage.includes('delivery time') ||
 lowerMessage.includes('shipping time') ||
 lowerMessage.includes('estimated')
 ) {
 return { type:'delivery_time', params: {} };
 }
 return { type:'shipping_policy', params: {} };
 }

 // Check for return policy
 if (
 lowerMessage.includes('return') ||
 lowerMessage.includes('refund') ||
 lowerMessage.includes('exchange') ||
 lowerMessage.includes('money back') ||
 lowerMessage.includes('send back') ||
 lowerMessage.includes('return policy')
 ) {
 return { type:'return_policy', params: {} };
 }

 // Check for payment info
 if (
 lowerMessage.includes('payment method') ||
 lowerMessage.includes('pay with') ||
 lowerMessage.includes('credit card') ||
 lowerMessage.includes('debit card') ||
 lowerMessage.includes('apple pay') ||
 lowerMessage.includes('google pay') ||
 lowerMessage.includes('how to pay') ||
 lowerMessage.includes('payment option') ||
 lowerMessage.includes('accepted payment')
 ) {
 return { type:'payment_info', params: {} };
 }

 // Check for about us
 if (
 lowerMessage.includes('about bazaar') ||
 lowerMessage.includes('about you') ||
 lowerMessage.includes('about this') ||
 lowerMessage.includes('what is bazaar') ||
 lowerMessage.includes('who are you') ||
 lowerMessage.includes('your story') ||
 lowerMessage.includes('tell me about the store') ||
 lowerMessage.includes('tell me about the site') ||
 lowerMessage.includes('company info') ||
 lowerMessage.includes('who made this')
 ) {
 return { type:'about_us', params: {} };
 }

 // Check for contact info
 if (
 lowerMessage.includes('contact') ||
 lowerMessage.includes('email') ||
 lowerMessage.includes('phone number') ||
 lowerMessage.includes('reach you') ||
 lowerMessage.includes('customer service') ||
 lowerMessage.includes('support team') ||
 lowerMessage.includes('call you') ||
 lowerMessage.includes('get in touch')
 ) {
 return { type:'contact_info', params: {} };
 }

 // Check for hours
 if (
 lowerMessage.includes('hour') ||
 lowerMessage.includes('open') ||
 lowerMessage.includes('close') ||
 lowerMessage.includes('business hour') ||
 lowerMessage.includes('when are you') ||
 lowerMessage.includes('operating hour') ||
 lowerMessage.includes('store hours')
 ) {
 return { type:'hours', params: {} };
 }

 // Check for size guide
 if (
 lowerMessage.includes('size') ||
 lowerMessage.includes('sizing') ||
 lowerMessage.includes('measurement') ||
 lowerMessage.includes('fit') ||
 lowerMessage.includes('size guide') ||
 lowerMessage.includes('size chart')
 ) {
 return { type:'size_guide', params: {} };
 }

 // Check for gift cards
 if (
 lowerMessage.includes('gift card') ||
 lowerMessage.includes('gift certificate') ||
 lowerMessage.includes('gift voucher') ||
 lowerMessage.includes('e-gift') ||
 lowerMessage.includes('gifting')
 ) {
 return { type:'gift_cards', params: {} };
 }

 // Check for promotions
 if (
 lowerMessage.includes('promo') ||
 lowerMessage.includes('coupon') ||
 lowerMessage.includes('discount code') ||
 lowerMessage.includes('promo code') ||
 lowerMessage.includes('voucher')
 ) {
 return { type:'promotions', params: {} };
 }

 // Check for loyalty program
 if (
 lowerMessage.includes('loyalty') ||
 lowerMessage.includes('reward') ||
 lowerMessage.includes('points') ||
 lowerMessage.includes('vip') ||
 lowerMessage.includes('membership')
 ) {
 return { type:'loyalty', params: {} };
 }

 // Check for order help
 if (
 lowerMessage.includes('order help') ||
 lowerMessage.includes('order issue') ||
 lowerMessage.includes('order problem') ||
 lowerMessage.includes('cancel order') ||
 lowerMessage.includes('modify order') ||
 lowerMessage.includes('change order') ||
 lowerMessage.includes('order late')
 ) {
 return { type:'order_help', params: {} };
 }

 // Check for account help
 if (
 lowerMessage.includes('account') ||
 lowerMessage.includes('login') ||
 lowerMessage.includes('sign up') ||
 lowerMessage.includes('register') ||
 lowerMessage.includes('password') ||
 lowerMessage.includes('profile') ||
 lowerMessage.includes('forgot password')
 ) {
 return { type:'account_help', params: {} };
 }

 // Check for security
 if (
 lowerMessage.includes('security') ||
 lowerMessage.includes('safe') ||
 lowerMessage.includes('privacy') ||
 lowerMessage.includes('data protection') ||
 lowerMessage.includes('secure') ||
 lowerMessage.includes('trust')
 ) {
 return { type:'security', params: {} };
 }

 // Check for sustainability
 if (
 lowerMessage.includes('sustainability') ||
 lowerMessage.includes('eco') ||
 lowerMessage.includes('environment') ||
 lowerMessage.includes('green') ||
 lowerMessage.includes('carbon') ||
 lowerMessage.includes('packaging')
 ) {
 return { type:'sustainability', params: {} };
 }

 // Check for careers
 if (
 lowerMessage.includes('career') ||
 lowerMessage.includes('job') ||
 lowerMessage.includes('hiring') ||
 lowerMessage.includes('work at') ||
 lowerMessage.includes('join the team') ||
 lowerMessage.includes('employment')
 ) {
 return { type:'careers', params: {} };
 }

 // Check for help
 if (
 lowerMessage.includes('help') ||
 lowerMessage.includes('what can you do') ||
 lowerMessage.includes('how do i') ||
 lowerMessage.includes('faq') ||
 lowerMessage.includes('guide') ||
 lowerMessage.includes('assist')
 ) {
 return { type:'help', params: {} };
 }

 // Check for deals / discounts
 if (
 lowerMessage.includes('deal') ||
 lowerMessage.includes('discount') ||
 lowerMessage.includes('sale') ||
 lowerMessage.includes('offer') ||
 lowerMessage.includes('show deals')
 ) {
 return { type:'deals', params: {} };
 }

 // Check for popular products
 if (
 lowerMessage.includes('popular') ||
 lowerMessage.includes('trending') ||
 lowerMessage.includes('top rated') ||
 lowerMessage.includes('bestsell') ||
 lowerMessage.includes('best sell')
 ) {
 return { type:'popular', params: {} };
 }

 // Check for new arrivals
 if (
 lowerMessage.includes('new arrival') ||
 lowerMessage.includes('latest') ||
 lowerMessage.includes('just added') ||
 lowerMessage.includes('newest')
 ) {
 return { type:'new_arrivals', params: {} };
 }

 // Check for track order
 if (
 lowerMessage.includes('track') ||
 lowerMessage.includes('where is my order') ||
 lowerMessage.includes('order status') ||
 lowerMessage.includes('track my order')
 ) {
 return { type:'track_order', params: {} };
 }

 // Admin: inventory status
 if (
 lowerMessage.includes('inventory') ||
 lowerMessage.includes('stock level') ||
 lowerMessage.includes('inventory status')
 ) {
 return { type:'inventory_status', params: {} };
 }

 // Admin: recent orders
 if (
 lowerMessage.includes('recent order') ||
 lowerMessage.includes('latest order') ||
 lowerMessage.includes('order history')
 ) {
 return { type:'recent_orders', params: {} };
 }

 // Admin: low stock
 if (
 lowerMessage.includes('low stock') ||
 lowerMessage.includes('out of stock') ||
 lowerMessage.includes('stock alert')
 ) {
 return { type:'low_stock', params: {} };
 }

 // Admin: customer accounts
 if (
 lowerMessage.includes('customer account') ||
 lowerMessage.includes('customer list') ||
 lowerMessage.includes('user account') ||
 lowerMessage.includes('registered user')
 ) {
 return { type:'customer_accounts', params: {} };
 }

 // Admin: unavailable product alerts
 if (
 lowerMessage.includes('unavailable alert') ||
 lowerMessage.includes('missed request') ||
 lowerMessage.includes('product request')
 ) {
 return { type:'unavailable_alerts', params: {} };
 }
 
 // Default intent
 return { type:'unknown', params: {} };
}

// Handle product search
async function handleProductSearch(params, isAdmin) {
 const filter = {};
 
 if (params.search) {
 const escaped = escapeRegex(params.search);
 filter.$or = [
 { name: { $regex: new RegExp(escaped,'i') } },
 { description: { $regex: new RegExp(escaped,'i') } }
 ];
 }
 
 if (params.category) {
 const categoryObj = await Category.findOne({ 
 name: { $regex: new RegExp(escapeRegex(params.category),'i') } 
 });
 
 if (categoryObj) {
 filter.category = categoryObj._id;
 }
 }
 
 if (params.minPrice) {
 filter.price = filter.price || {};
 filter.price.$gte = Number(params.minPrice);
 }
 
 if (params.maxPrice) {
 filter.price = filter.price || {};
 filter.price.$lte = Number(params.maxPrice);
 }
 
 // For non-admin users, only show active products
 if (!isAdmin) {
 filter.isActive = true;
 }
 
 const products = await Product.find(filter)
.populate('category','name')
.limit(5);
 
 return products;
}

// Handle product details request
async function handleProductDetails(params, isAdmin) {
 if (!params.search) return null;
 
 const filter = {
 name: { $regex: new RegExp(escapeRegex(params.search),'i') }
 };
 
 // For non-admin users, only show active products
 if (!isAdmin) {
 filter.isActive = true;
 }
 
 const product = await Product.findOne(filter)
.populate('category','name');
 
 return product;
}

// Handle category inquiry
async function handleCategoryInquiry(isAdmin) {
 const filter = isAdmin? {} : { isActive: true };
 
 const categories = await Category.find(filter)
.sort({ name: 1 })
.limit(10);
 
 return categories;
}

// Handle price inquiry
async function handlePriceInquiry(params, isAdmin) {
 if (!params.search) return null;
 
 const filter = {
 name: { $regex: new RegExp(escapeRegex(params.search),'i') }
 };
 
 // For non-admin users, only show active products
 if (!isAdmin) {
 filter.isActive = true;
 }
 
 const product = await Product.findOne(filter);
 
 return product;
}

// Handle stock inquiry
async function handleStockInquiry(params, isAdmin) {
 if (!params.search) return null;
 
 const filter = {
 name: { $regex: new RegExp(escapeRegex(params.search),'i') }
 };
 
 // For non-admin users, only show active products
 if (!isAdmin) {
 filter.isActive = true;
 }
 
 const product = await Product.findOne(filter);
 
 return product;
}

// Handle recommendation
async function handleRecommendation(params, isAdmin) {
 const filter = {};
 
 if (params.category) {
 const categoryObj = await Category.findOne({ 
 name: { $regex: new RegExp(params.category,'i') } 
 });
 
 if (categoryObj) {
 filter.category = categoryObj._id;
 }
 }
 
 if (params.maxPrice) {
 filter.price = { $lte: Number(params.maxPrice) };
 }
 
 // For non-admin users, only show active products
 if (!isAdmin) {
 filter.isActive = true;
 }
 
 // Find top-rated products that match the criteria
 const products = await Product.find(filter)
.populate('category','name')
.sort({ rating: -1 })
.limit(3);
 
 return products;
}

// Handle deals - products with discounts
async function handleDeals(isAdmin) {
 const filter = { discountPercentage: { $gt: 0 } };
 if (!isAdmin) filter.isActive = true;

 const products = await Product.find(filter)
.populate('category','name')
.sort({ discountPercentage: -1 })
.limit(5);

 return { products };
}

// Handle popular / top-rated products
async function handlePopular(isAdmin) {
 const filter = {};
 if (!isAdmin) filter.isActive = true;

 const products = await Product.find(filter)
.populate('category','name')
.sort({ rating: -1, numReviews: -1 })
.limit(5);

 return { products };
}

// Handle new arrivals
async function handleNewArrivals(isAdmin) {
 const filter = {};
 if (!isAdmin) filter.isActive = true;

 const products = await Product.find(filter)
.populate('category','name')
.sort({ createdAt: -1 })
.limit(5);

 return { products };
}

// Admin: inventory status overview
async function handleInventoryStatus() {
 const totalProducts = await Product.countDocuments();
 const outOfStock = await Product.countDocuments({ stock: 0 });
 const lowStock = await Product.countDocuments({ stock: { $gt: 0, $lte: 5 } });
 const healthy = totalProducts - outOfStock - lowStock;

 const criticalItems = await Product.find({ stock: { $lte: 5 } })
.select('name stock price')
.sort({ stock: 1 })
.limit(10);

 return {
 adminData: {
 type:'inventory',
 data: criticalItems
 },
 summary: { totalProducts, outOfStock, lowStock, healthy }
 };
}

// Admin: recent orders
async function handleRecentOrders() {
 const orders = await Order.find()
.populate('user','name email')
.sort({ createdAt: -1 })
.limit(10);

 const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

 return {
 adminData: {
 type:'orders',
 data: orders
 },
 summary: { count: orders.length, totalRevenue }
 };
}

// Admin: low stock alerts
async function handleLowStock() {
 const products = await Product.find({ stock: { $lte: 5 } })
.select('name stock price category')
.populate('category','name')
.sort({ stock: 1 })
.limit(15);

 return {
 adminData: {
 type:'inventory',
 data: products
 },
 count: products.length
 };
}

// Admin: customer accounts
async function handleCustomerAccounts() {
 const customers = await User.find({ role:'customer'})
.select('name email isActive createdAt')
.sort({ createdAt: -1 })
.limit(10);

 const totalCustomers = await User.countDocuments({ role:'customer'});
 const activeCustomers = await User.countDocuments({ role:'customer', isActive: true });

 return {
 adminData: {
 type:'accounts',
 data: customers
 },
 summary: { totalCustomers, activeCustomers }
 };
}

// Format responses with ultra-friendly personality
function formatProductSearchResponse(products, intent) {
 const items = products?.products || products;
 if (!items || items.length === 0) {
 return `${pickRandom(notFoundSofteners)} Would you like me to suggest some popular items instead, or try a different search? I'm determined to find you something you'll love! `;
 }
 
 let response = `${pickRandom(encouragements)} I found ${items.length} amazing product${items.length > 1?'s':''} for you! `;
 
 items.forEach((product, index) => {
 if (index > 0) response += `; `;
 const price = product.discountPercentage > 0 
? `~~$${product.price.toFixed(2)}~~ **$${product.discountedPrice.toFixed(2)}** (score! )`
 : `$${product.price.toFixed(2)}`;
 response += `**${product.name}** (${price})`;
 });
 
 response += `. Want more details on any of these? Just click a product or ask me! I could talk about these all day! `;
 
 return response;
}

function formatProductDetailsResponse(product) {
 if (!product) {
 return `${pickRandom(notFoundSofteners)} Can you try being more specific with the name? I really want to help you find it! `;
 }
 
 let price = product.discountPercentage > 0 
? `**$${product.discountedPrice.toFixed(2)}** (${product.discountPercentage}% off from $${product.price.toFixed(2)} — what a steal! )` 
 : `**$${product.price.toFixed(2)}**`;
 
 let response = `Ooh, great choice! Let me tell you about **${product.name}**! \n\n${product.description}\n\n **Price**: ${price}\n`;
 
 if (product.stock > 10) {
 response += ` **Stock**: Plenty available (${product.stock} units) — no rush, but also why wait? \n`;
 } else if (product.stock > 0) {
 response += ` **Stock**: Only ${product.stock} left! I'd grab it quick before someone else does! \n`;
 } else {
 response += ` **Stock**: Unfortunately out of stock right now. Want me to find similar alternatives?\n`;
 }
 
 response += ` **Category**: ${product.category? product.category.name :'Uncategorized'}\n`;
 
 if (product.rating > 0) {
 const stars =''.repeat(Math.round(product.rating));
 const sentiment = product.rating >= 4.5?'Customers absolutely LOVE it!': product.rating >= 3.5?'Solid reviews from happy buyers!':'Getting good feedback!';
 response += `\n${stars} **${product.rating.toFixed(1)}/5** (${product.numReviews} reviews) — ${sentiment}`;
 }
 
 return response;
}

function formatCategoryResponse(categories) {
 if (!categories || categories.length === 0) {
 return `Hmm, I'm not seeing any categories right now This might be temporary — try again in a moment! In the meantime, use the search to find specific products!`;
 }
 
 let response = `We've got **${categories.length} incredible categories** to explore! Here they are:\n\n`;
 
 categories.forEach((category, index) => {
 const emojis = ['','','','','','','','','',''];
 response += `${emojis[index % emojis.length]} **${category.name}**\n`;
 });
 
 response += `\nWhich one catches your eye? Click on any category or tell me and I'll help you explore! `;
 
 return response;
}

function formatPriceResponse(product) {
 if (!product) {
 return `${pickRandom(notFoundSofteners)} Could you double-check the product name for me? I want to get you the right price! `;
 }
 
 if (product.discountPercentage > 0) {
 return ` Great news! **${product.name}** is currently on SALE for **$${product.discountedPrice.toFixed(2)}** — that's ${product.discountPercentage}% off the original $${product.price.toFixed(2)}! What a deal! Don't miss out!`;
 }
 return ` **${product.name}** is priced at **$${product.price.toFixed(2)}**. ${pickRandom(encouragements)} Want to add it to your cart?`;
}

function formatStockResponse(product) {
 if (!product) {
 return `${pickRandom(notFoundSofteners)} Mind trying a different product name? I'll find it! `;
 }
 
 if (product.stock > 10) {
 return ` Yes! **${product.name}** is in stock with **${product.stock} units** available. You're good to go — happy shopping! `;
 } else if (product.stock > 0) {
 return ` **${product.name}** is available, but hurry — only **${product.stock} left**! I'd grab it soon if I were you! `;
 } else {
 return ` Oh no, **${product.name}** is currently out of stock. Want me to suggest some amazing alternatives? I bet I can find something you'll love just as much!`;
 }
}

function formatRecommendationResponse(products) {
 if (!products || products.length === 0) {
 return `I couldn't find specific recommendations right now, but don't worry! Try asking me for"popular products"or"new arrivals"— those are always crowd-pleasers! `;
 }
 
 let response = ` Here are my **hand-picked recommendations** just for you! `;
 
 products.forEach((product, index) => {
 if (index > 0) response += `; `;
 const price = product.discountPercentage > 0
? `**$${product.discountedPrice.toFixed(2)}**`
 : `**$${product.price.toFixed(2)}**`;
 const ratingBadge = product.rating >= 4?'Top Rated!':'';
 response += `**${product.name}** (${price})${ratingBadge}`;
 });
 
 response += `. I personally love all of these! Want to know more about any? `;
 
 return response;
}

function formatDealsResponse(data) {
 const products = data?.products;
 if (!products || products.length === 0) {
 return `No active deals at the moment, but keep checking back — we add new offers ALL the time! Pro tip: subscribe to our newsletter for early access to sales! `;
 }

 let response = ` **HOT DEALS** happening right now! These won't last forever: `;
 products.forEach((product, index) => {
 if (index > 0) response += `; `;
 response += `**${product.name}** — ${product.discountPercentage}% OFF (now just $${product.discountedPrice.toFixed(2)}! )`;
 });
 response += `. Don't miss out — grab these before they're gone! `;

 return response;
}

function formatPopularResponse(data) {
 const products = data?.products;
 if (!products || products.length === 0) {
 return `I'm having trouble loading popular products right now Try again in a moment — they're worth the wait! `;
 }

 let response = ` **Our Most Loved Products** (by real customers like you!): `;
 products.forEach((product, index) => {
 if (index > 0) response += `; `;
 response += `**${product.name}** (${''.repeat(Math.min(Math.round(product.rating), 5))} ${product.rating.toFixed(1)}, ${product.numReviews} reviews)`;
 });
 response += `. These are absolute crowd favorites! Want to check any of them out? `;

 return response;
}

function formatNewArrivalsResponse(data) {
 const products = data?.products;
 if (!products || products.length === 0) {
 return `No new arrivals to show just yet, but stay tuned! We're always adding exciting new products! 🆕`;
 }

 let response = ` **Fresh Off the Shelf** — Our Latest Arrivals: `;
 products.forEach((product, index) => {
 if (index > 0) response += `; `;
 response += `**${product.name}** ($${product.price.toFixed(2)})`;
 });
 response += `. Be the first to rock these! 🆕`;

 return response;
}

function formatInventoryResponse(data) {
 const { summary } = data;
 let response = ` **Inventory Overview**\n\n`;
 response += ` Total Products: **${summary.totalProducts}**\n`;
 response += ` Healthy Stock: **${summary.healthy}**\n`;
 response += ` Low Stock: **${summary.lowStock}**\n`;
 response += ` Out of Stock: **${summary.outOfStock}**\n\n`;
 if (summary.outOfStock > 0 || summary.lowStock > 0) {
 response += `I've listed the critical items below — consider restocking soon! `;
 } else {
 response += `Everything looks fantastic — all stocked up! `;
 }
 return response;
}

function formatRecentOrdersResponse(data) {
 const { summary } = data;
 let response = ` **Recent Orders Report**\n\n`;
 response += `We've got **${summary.count}** recent orders rolling in! \n`;
 response += ` Combined revenue: **$${summary.totalRevenue.toFixed(2)}**\n\n`;
 response += `Check out the details in the table below — your store is buzzing! `;
 return response;
}

function formatLowStockResponse(data) {
 if (!data.count || data.count === 0) {
 return ` **All Clear!** No products are running low on stock right now! Everything is beautifully stocked. You're on top of it! `;
 }
 return ` **Low Stock Alert!**\n\nFound **${data.count}** product${data.count > 1?'s':''} with critically low stock (5 or fewer units). \n\nThese need restocking attention ASAP — check the details below! `;
}

function formatCustomerAccountsResponse(data) {
 const { summary } = data;
 return ` **Customer Overview**\n\n **${summary.totalCustomers}** total customers | **${summary.activeCustomers}** active\n\nHere are the most recent sign-ups below — your community is growing! `;
}

function formatUnavailableAlertsResponse(data) {
 if (!data.alerts || data.alerts.length === 0) {
 return ` **No Missed Searches!** No unavailable product requests from customers yet — that means we're covering demand perfectly! Great job keeping the catalog stocked! `;
 }
 
 const uniqueQueries = {};
 data.alerts.forEach(alert => {
 if (!uniqueQueries[alert.query]) uniqueQueries[alert.query] = 0;
 uniqueQueries[alert.query]++;
 });

 let response = ` **Missed Product Searches**\n\nCustomers searched for **${data.alerts.length}** product(s) we couldn't fulfill. Here are the top missed searches:\n\n`;
 const sorted = Object.entries(uniqueQueries).sort((a, b) => b[1] - a[1]).slice(0, 5);
 sorted.forEach(([query, count], i) => {
 response += `${i + 1}."**${query}**"— searched ${count} time${count > 1?'s':''} \n`;
 });
 response += `\n Consider adding these to your catalog — there's customer demand waiting!`;
 return response;
} 