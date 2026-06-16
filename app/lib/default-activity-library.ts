export type DefaultActivityLibraryItem = {
  theme: string;
  activity_name: string;
  description: string;
  developmental_area: string;
};

export const defaultActivityLibrary: DefaultActivityLibraryItem[] = [
  // ALL ABOUT ME
  { theme: "All About Me", activity_name: "Introducing Myself", description: "Learners introduce themselves by saying their name and sharing something about themselves.", developmental_area: "Language" },
  { theme: "All About Me", activity_name: "Self Portrait", description: "Learners draw and colour a picture of themselves.", developmental_area: "Creative Art" },
  { theme: "All About Me", activity_name: "My Name", description: "Learners recognise, trace or identify their name.", developmental_area: "Fine Motor" },
  { theme: "All About Me", activity_name: "My Favourite Things", description: "Learners discuss favourite foods, colours, toys or activities.", developmental_area: "Language" },
  { theme: "All About Me", activity_name: "What Makes Me Special", description: "Learners discuss what makes them unique and special.", developmental_area: "Life Skills" },

  // MY BODY
  { theme: "My Body", activity_name: "Naming Body Parts", description: "Learners identify and name body parts.", developmental_area: "Language" },
  { theme: "My Body", activity_name: "My Five Senses", description: "Learners explore sight, hearing, touch, taste and smell.", developmental_area: "Life Skills" },
  { theme: "My Body", activity_name: "Body Movements", description: "Learners move different body parts through action games.", developmental_area: "Gross Motor" },
  { theme: "My Body", activity_name: "Trace My Hand", description: "Learners trace and decorate a hand outline.", developmental_area: "Fine Motor" },
  { theme: "My Body", activity_name: "Keeping Clean", description: "Learners discuss hygiene and self-care.", developmental_area: "Life Skills" },

  // MY FAMILY
  { theme: "My Family", activity_name: "Family Discussion", description: "Learners talk about family members and people who live with them.", developmental_area: "Language" },
  { theme: "My Family", activity_name: "Draw My Family", description: "Learners draw and describe their family.", developmental_area: "Creative Art" },
  { theme: "My Family", activity_name: "Family Role Play", description: "Learners act out simple family activities.", developmental_area: "Life Skills" },
  { theme: "My Family", activity_name: "Family Story", description: "Learners listen to and discuss a family story.", developmental_area: "Story Time" },
  { theme: "My Family", activity_name: "Caring For Family", description: "Learners discuss helping and respecting family members.", developmental_area: "Life Skills" },

  // MY HOME
  { theme: "My Home", activity_name: "Rooms In My Home", description: "Learners identify rooms found in a home.", developmental_area: "Language" },
  { theme: "My Home", activity_name: "Draw My House", description: "Learners draw a house and its features.", developmental_area: "Creative Art" },
  { theme: "My Home", activity_name: "Home Safety", description: "Learners identify safe and unsafe situations at home.", developmental_area: "Life Skills" },
  { theme: "My Home", activity_name: "Helping At Home", description: "Learners discuss ways they can help at home.", developmental_area: "Life Skills" },
  { theme: "My Home", activity_name: "Build A House", description: "Learners build houses using blocks, boxes or shapes.", developmental_area: "Fine Motor" },

  // MY SCHOOL
  { theme: "My School", activity_name: "School Tour", description: "Learners walk around the school and identify important places.", developmental_area: "Outdoor Play" },
  { theme: "My School", activity_name: "Classroom Rules", description: "Learners discuss simple classroom rules and routines.", developmental_area: "Life Skills" },
  { theme: "My School", activity_name: "Meet My Teacher", description: "Learners talk about their teacher and classroom helpers.", developmental_area: "Language" },
  { theme: "My School", activity_name: "School Helpers", description: "Learners identify people who help at school.", developmental_area: "Life Skills" },
  { theme: "My School", activity_name: "Caring For School Property", description: "Learners discuss how to care for books, toys and classroom materials.", developmental_area: "Life Skills" },

  // FRIENDS
  { theme: "Friends", activity_name: "Friendship Circle", description: "Learners sit in a circle and talk about what makes a good friend.", developmental_area: "Language" },
  { theme: "Friends", activity_name: "Sharing Game", description: "Learners practise sharing and taking turns during play.", developmental_area: "Life Skills" },
  { theme: "Friends", activity_name: "Helping A Friend", description: "Learners discuss and act out ways to help friends.", developmental_area: "Life Skills" },
  { theme: "Friends", activity_name: "Friendship Art", description: "Learners create a simple friendship picture or card.", developmental_area: "Creative Art" },
  { theme: "Friends", activity_name: "Kind Words", description: "Learners practise using kind words with classmates.", developmental_area: "Language" },

  // FEELINGS
  { theme: "Feelings", activity_name: "Happy Sad Angry", description: "Learners identify basic feelings such as happy, sad and angry.", developmental_area: "Life Skills" },
  { theme: "Feelings", activity_name: "Emotion Matching", description: "Learners match emotion pictures to feeling words.", developmental_area: "Language" },
  { theme: "Feelings", activity_name: "Feelings Discussion", description: "Learners talk about how they feel and what causes feelings.", developmental_area: "Language" },
  { theme: "Feelings", activity_name: "Facial Expressions", description: "Learners make and identify different facial expressions.", developmental_area: "Life Skills" },
  { theme: "Feelings", activity_name: "Managing Feelings", description: "Learners discuss simple ways to calm down and ask for help.", developmental_area: "Life Skills" },

  // HEALTHY LIVING
  { theme: "Healthy Living", activity_name: "Healthy Foods", description: "Learners identify healthy foods from pictures or real examples.", developmental_area: "Life Skills" },
  { theme: "Healthy Living", activity_name: "Exercise Time", description: "Learners take part in simple movement exercises.", developmental_area: "Gross Motor" },
  { theme: "Healthy Living", activity_name: "Drinking Water", description: "Learners discuss why drinking water is important.", developmental_area: "Life Skills" },
  { theme: "Healthy Living", activity_name: "Healthy Habits", description: "Learners discuss habits that help the body stay healthy.", developmental_area: "Life Skills" },
  { theme: "Healthy Living", activity_name: "Healthy Lunchbox", description: "Learners sort lunchbox items into healthy choices and treats.", developmental_area: "Life Skills" },

  // PERSONAL HYGIENE
  { theme: "Personal Hygiene", activity_name: "Washing Hands", description: "Learners practise the steps for washing hands properly.", developmental_area: "Life Skills" },
  { theme: "Personal Hygiene", activity_name: "Brushing Teeth", description: "Learners discuss and practise brushing teeth using pictures or models.", developmental_area: "Life Skills" },
  { theme: "Personal Hygiene", activity_name: "Bath Time Routine", description: "Learners talk about bathing and keeping the body clean.", developmental_area: "Life Skills" },
  { theme: "Personal Hygiene", activity_name: "Clean Clothes", description: "Learners discuss why clean clothes are important.", developmental_area: "Life Skills" },
  { theme: "Personal Hygiene", activity_name: "Germ Prevention", description: "Learners learn simple ways to prevent spreading germs.", developmental_area: "Life Skills" },

  // SAFETY
  { theme: "Safety", activity_name: "Road Safety", description: "Learners discuss safe ways to cross the road.", developmental_area: "Life Skills" },
  { theme: "Safety", activity_name: "Stranger Danger", description: "Learners discuss safe behaviour around unfamiliar people.", developmental_area: "Life Skills" },
  { theme: "Safety", activity_name: "Safe And Unsafe", description: "Learners identify safe and unsafe situations using pictures.", developmental_area: "Life Skills" },
  { theme: "Safety", activity_name: "Emergency Helpers", description: "Learners identify people who help during emergencies.", developmental_area: "Language" },
  { theme: "Safety", activity_name: "Safety Role Play", description: "Learners act out simple safety situations.", developmental_area: "Life Skills" },

  // COMMUNITY HELPERS
  { theme: "Community Helpers", activity_name: "Doctors And Nurses", description: "Learners discuss how doctors and nurses help people.", developmental_area: "Language" },
  { theme: "Community Helpers", activity_name: "Police Officers", description: "Learners discuss how police officers help keep people safe.", developmental_area: "Life Skills" },
  { theme: "Community Helpers", activity_name: "Firefighters", description: "Learners discuss firefighters and fire safety.", developmental_area: "Life Skills" },
  { theme: "Community Helpers", activity_name: "Teachers", description: "Learners talk about how teachers help children learn.", developmental_area: "Language" },
  { theme: "Community Helpers", activity_name: "Community Helper Dress Up", description: "Learners dress up or role play different community helpers.", developmental_area: "Creative Art" },

  // TRANSPORT
  { theme: "Transport", activity_name: "Types Of Transport", description: "Learners identify different types of transport.", developmental_area: "Language" },
  { theme: "Transport", activity_name: "Vehicle Sounds", description: "Learners imitate sounds made by vehicles.", developmental_area: "Music & Movement" },
  { theme: "Transport", activity_name: "Build A Vehicle", description: "Learners build a vehicle using blocks, boxes or recycled material.", developmental_area: "Fine Motor" },
  { theme: "Transport", activity_name: "Traffic Lights", description: "Learners learn what red, yellow and green traffic lights mean.", developmental_area: "Life Skills" },
  { theme: "Transport", activity_name: "Transport Sorting", description: "Learners sort transport into land, air and water transport.", developmental_area: "Mathematics" },

  // WEATHER
  { theme: "Weather", activity_name: "Today's Weather", description: "Learners discuss today's weather.", developmental_area: "Ring Time" },
  { theme: "Weather", activity_name: "Weather Chart", description: "Learners record the weather on a classroom chart.", developmental_area: "Mathematics" },
  { theme: "Weather", activity_name: "Dressing For Weather", description: "Learners match clothing to weather conditions.", developmental_area: "Life Skills" },
  { theme: "Weather", activity_name: "Rain Cloud Art", description: "Learners create weather-themed artwork.", developmental_area: "Creative Art" },
  { theme: "Weather", activity_name: "Weather Walk", description: "Learners observe weather conditions outdoors.", developmental_area: "Outdoor Play" },

  // SEASONS
  { theme: "Seasons", activity_name: "Summer", description: "Learners discuss summer weather, clothing and activities.", developmental_area: "Language" },
  { theme: "Seasons", activity_name: "Autumn", description: "Learners discuss autumn leaves, colours and weather changes.", developmental_area: "Language" },
  { theme: "Seasons", activity_name: "Winter", description: "Learners discuss winter clothing and cold weather.", developmental_area: "Life Skills" },
  { theme: "Seasons", activity_name: "Spring", description: "Learners discuss flowers, plants and warmer weather.", developmental_area: "Language" },
  { theme: "Seasons", activity_name: "Seasonal Clothing", description: "Learners match clothes to different seasons.", developmental_area: "Life Skills" },

  // WATER
  { theme: "Water", activity_name: "Uses Of Water", description: "Learners discuss how people use water every day.", developmental_area: "Life Skills" },
  { theme: "Water", activity_name: "Saving Water", description: "Learners discuss simple ways to save water.", developmental_area: "Life Skills" },
  { theme: "Water", activity_name: "Floating And Sinking", description: "Learners test objects to see whether they float or sink.", developmental_area: "Mathematics" },
  { theme: "Water", activity_name: "Water Safety", description: "Learners discuss safe behaviour around water.", developmental_area: "Life Skills" },
  { theme: "Water", activity_name: "Water Play", description: "Learners explore pouring, filling and emptying containers.", developmental_area: "Sensory Development" },

  // FARM ANIMALS
  { theme: "Farm Animals", activity_name: "Farm Animal Names", description: "Learners identify and name common farm animals.", developmental_area: "Language" },
  { theme: "Farm Animals", activity_name: "Animal Sounds", description: "Learners match farm animals to their sounds.", developmental_area: "Music & Movement" },
  { theme: "Farm Animals", activity_name: "Matching Babies", description: "Learners match farm animals to their babies.", developmental_area: "Mathematics" },
  { theme: "Farm Animals", activity_name: "Farm Animal Art", description: "Learners create a farm animal using drawing, painting or collage.", developmental_area: "Creative Art" },
  { theme: "Farm Animals", activity_name: "Farm Story", description: "Learners listen to a story about life on a farm.", developmental_area: "Story Time" },

  // WILD ANIMALS
  { theme: "Wild Animals", activity_name: "African Animals", description: "Learners identify familiar African wild animals.", developmental_area: "Language" },
  { theme: "Wild Animals", activity_name: "Animal Habitats", description: "Learners discuss where wild animals live.", developmental_area: "Life Skills" },
  { theme: "Wild Animals", activity_name: "Animal Movements", description: "Learners move like different wild animals.", developmental_area: "Gross Motor" },
  { theme: "Wild Animals", activity_name: "Animal Masks", description: "Learners create simple animal masks.", developmental_area: "Creative Art" },
  { theme: "Wild Animals", activity_name: "Safari Adventure", description: "Learners listen to or act out a safari story.", developmental_area: "Story Time" },

  // PETS
  { theme: "Pets", activity_name: "My Pet", description: "Learners talk about pets they have or know.", developmental_area: "Language" },
  { theme: "Pets", activity_name: "Caring For Pets", description: "Learners discuss how to care for pets.", developmental_area: "Life Skills" },
  { theme: "Pets", activity_name: "Pet Foods", description: "Learners match pets to food they may eat.", developmental_area: "Mathematics" },
  { theme: "Pets", activity_name: "Draw A Pet", description: "Learners draw a pet or favourite animal.", developmental_area: "Creative Art" },
  { theme: "Pets", activity_name: "Responsible Pet Care", description: "Learners discuss kindness and responsibility towards animals.", developmental_area: "Life Skills" },

  // INSECTS
  { theme: "Insects", activity_name: "Butterfly Life Cycle", description: "Learners are introduced to the butterfly life cycle using pictures.", developmental_area: "Life Skills" },
  { theme: "Insects", activity_name: "Ant Investigation", description: "Learners observe ants safely and discuss what ants do.", developmental_area: "Outdoor Play" },
  { theme: "Insects", activity_name: "Insect Hunt", description: "Learners look for insects outdoors with teacher guidance.", developmental_area: "Outdoor Play" },
  { theme: "Insects", activity_name: "Ladybird Art", description: "Learners create a ladybird picture using dots and colour.", developmental_area: "Creative Art" },
  { theme: "Insects", activity_name: "Insect Sorting", description: "Learners sort insects by colour, size or number of legs.", developmental_area: "Mathematics" },

  // PLANTS
  { theme: "Plants", activity_name: "Planting Seeds", description: "Learners plant seeds and discuss what plants need to grow.", developmental_area: "Life Skills" },
  { theme: "Plants", activity_name: "Watering Plants", description: "Learners help water plants and discuss caring for living things.", developmental_area: "Life Skills" },
  { theme: "Plants", activity_name: "Parts Of A Plant", description: "Learners identify roots, stem, leaves and flowers.", developmental_area: "Language" },
  { theme: "Plants", activity_name: "Flower Art", description: "Learners create flower artwork using drawing, painting or collage.", developmental_area: "Creative Art" },
  { theme: "Plants", activity_name: "Growing A Garden", description: "Learners discuss gardens and what grows in them.", developmental_area: "Outdoor Play" },

  // FRUITS AND VEGETABLES
  { theme: "Fruits And Vegetables", activity_name: "Fruit Tasting", description: "Learners taste familiar fruits and describe them.", developmental_area: "Sensory Development" },
  { theme: "Fruits And Vegetables", activity_name: "Vegetable Sorting", description: "Learners sort vegetable pictures or real vegetables.", developmental_area: "Mathematics" },
  { theme: "Fruits And Vegetables", activity_name: "Healthy Foods", description: "Learners discuss why fruits and vegetables are good for the body.", developmental_area: "Life Skills" },
  { theme: "Fruits And Vegetables", activity_name: "Market Role Play", description: "Learners pretend to buy and sell fruits and vegetables.", developmental_area: "Language" },
  { theme: "Fruits And Vegetables", activity_name: "Fruit And Vegetable Art", description: "Learners create artwork using fruit and vegetable shapes.", developmental_area: "Creative Art" },

  // SHAPES
  { theme: "Shapes", activity_name: "Shape Hunt", description: "Learners find shapes in the classroom or playground.", developmental_area: "Mathematics" },
  { theme: "Shapes", activity_name: "Shape Sorting", description: "Learners sort shapes by type, size or colour.", developmental_area: "Mathematics" },
  { theme: "Shapes", activity_name: "Shape Art", description: "Learners use shapes to make a picture.", developmental_area: "Creative Art" },
  { theme: "Shapes", activity_name: "Build With Shapes", description: "Learners build objects using shape blocks or cut-outs.", developmental_area: "Fine Motor" },
  { theme: "Shapes", activity_name: "Shape Matching", description: "Learners match identical shapes.", developmental_area: "Mathematics" },

  // COLOURS
  { theme: "Colours", activity_name: "Colour Hunt", description: "Learners look for colours in the classroom or outdoors.", developmental_area: "Language" },
  { theme: "Colours", activity_name: "Colour Matching", description: "Learners match objects or pictures by colour.", developmental_area: "Mathematics" },
  { theme: "Colours", activity_name: "Colour Mixing", description: "Learners explore mixing colours with paint or water.", developmental_area: "Creative Art" },
  { theme: "Colours", activity_name: "Rainbow Art", description: "Learners create a rainbow picture.", developmental_area: "Creative Art" },
  { theme: "Colours", activity_name: "Sorting Colours", description: "Learners sort classroom objects by colour.", developmental_area: "Mathematics" },

  // NUMBERS
  { theme: "Numbers", activity_name: "Counting Objects", description: "Learners count familiar classroom objects.", developmental_area: "Mathematics" },
  { theme: "Numbers", activity_name: "Number Recognition", description: "Learners identify number symbols.", developmental_area: "Mathematics" },
  { theme: "Numbers", activity_name: "Number Matching", description: "Learners match number symbols to groups of objects.", developmental_area: "Mathematics" },
  { theme: "Numbers", activity_name: "Number Songs", description: "Learners sing counting songs.", developmental_area: "Music & Movement" },
  { theme: "Numbers", activity_name: "Number Games", description: "Learners play simple counting and number games.", developmental_area: "Mathematics" },

  // PATTERNS
  { theme: "Patterns", activity_name: "Copy The Pattern", description: "Learners copy simple repeating patterns.", developmental_area: "Mathematics" },
  { theme: "Patterns", activity_name: "Bead Patterns", description: "Learners make patterns using beads.", developmental_area: "Fine Motor" },
  { theme: "Patterns", activity_name: "Colour Patterns", description: "Learners continue colour patterns.", developmental_area: "Mathematics" },
  { theme: "Patterns", activity_name: "Nature Patterns", description: "Learners create patterns using leaves, stones or sticks.", developmental_area: "Outdoor Play" },
  { theme: "Patterns", activity_name: "Pattern Making", description: "Learners create their own simple patterns.", developmental_area: "Mathematics" },

  // DAYS OF THE WEEK
  { theme: "Days Of The Week", activity_name: "Naming The Days", description: "Learners identify and name the days of the week.", developmental_area: "Language" },
  { theme: "Days Of The Week", activity_name: "What Day Is Today", description: "Learners identify the current day.", developmental_area: "Ring Time" },
  { theme: "Days Of The Week", activity_name: "Days Of The Week Song", description: "Learners sing the days of the week in order.", developmental_area: "Music & Movement" },
  { theme: "Days Of The Week", activity_name: "Arrange The Days", description: "Learners place days of the week in sequence.", developmental_area: "Mathematics" },
  { theme: "Days Of The Week", activity_name: "My Weekly Routine", description: "Learners discuss activities they do on different days.", developmental_area: "Life Skills" },

  // MONTHS OF THE YEAR
  { theme: "Months Of The Year", activity_name: "Naming The Months", description: "Learners identify and name the months of the year.", developmental_area: "Language" },
  { theme: "Months Of The Year", activity_name: "My Birthday Month", description: "Learners identify their birthday month.", developmental_area: "Life Skills" },
  { theme: "Months Of The Year", activity_name: "Months Song", description: "Learners sing the months of the year.", developmental_area: "Music & Movement" },
  { theme: "Months Of The Year", activity_name: "Arrange The Months", description: "Learners place months in sequence.", developmental_area: "Mathematics" },
  { theme: "Months Of The Year", activity_name: "Seasons And Months", description: "Learners link months to seasons in a simple way.", developmental_area: "Language" },

  // TIME
  { theme: "Time", activity_name: "Morning Afternoon Evening", description: "Learners identify activities done in the morning, afternoon and evening.", developmental_area: "Life Skills" },
  { theme: "Time", activity_name: "Daily Routines", description: "Learners discuss daily routines at home and school.", developmental_area: "Life Skills" },
  { theme: "Time", activity_name: "Before And After", description: "Learners discuss what happens before and after familiar events.", developmental_area: "Mathematics" },
  { theme: "Time", activity_name: "Today Yesterday Tomorrow", description: "Learners practise the words today, yesterday and tomorrow.", developmental_area: "Language" },
  { theme: "Time", activity_name: "What Happens First", description: "Learners sequence simple daily events.", developmental_area: "Mathematics" },

  // OPPOSITES
  { theme: "Opposites", activity_name: "Big And Small", description: "Learners compare objects that are big and small.", developmental_area: "Mathematics" },
  { theme: "Opposites", activity_name: "Long And Short", description: "Learners compare objects that are long and short.", developmental_area: "Mathematics" },
  { theme: "Opposites", activity_name: "Hot And Cold", description: "Learners discuss hot and cold objects or weather.", developmental_area: "Language" },
  { theme: "Opposites", activity_name: "Fast And Slow", description: "Learners move fast and slow during a movement game.", developmental_area: "Gross Motor" },
  { theme: "Opposites", activity_name: "Heavy And Light", description: "Learners compare objects that feel heavy and light.", developmental_area: "Mathematics" },

  // HERITAGE
  { theme: "Heritage", activity_name: "My Culture", description: "Learners talk about culture, family traditions or home languages.", developmental_area: "Language" },
  { theme: "Heritage", activity_name: "Traditional Clothing", description: "Learners look at and discuss traditional clothing.", developmental_area: "Life Skills" },
  { theme: "Heritage", activity_name: "Traditional Foods", description: "Learners discuss traditional foods from different families.", developmental_area: "Life Skills" },
  { theme: "Heritage", activity_name: "Heritage Art", description: "Learners create artwork inspired by colours, patterns or cultural items.", developmental_area: "Creative Art" },
  { theme: "Heritage", activity_name: "Cultural Celebrations", description: "Learners discuss respectful ways people celebrate culture.", developmental_area: "Life Skills" },

  // SOUTH AFRICA
  { theme: "South Africa", activity_name: "South African Flag", description: "Learners identify the South African flag and its colours.", developmental_area: "Life Skills" },
  { theme: "South Africa", activity_name: "National Symbols", description: "Learners are introduced to simple South African national symbols.", developmental_area: "Life Skills" },
  { theme: "South Africa", activity_name: "Provinces", description: "Learners are introduced to provinces in a simple map or picture activity.", developmental_area: "Language" },
  { theme: "South Africa", activity_name: "South African Animals", description: "Learners identify animals commonly associated with South Africa.", developmental_area: "Language" },
  { theme: "South Africa", activity_name: "Proudly South African", description: "Learners talk about things they know and love about South Africa.", developmental_area: "Life Skills" },

  // SPORTS AND MOVEMENT
  { theme: "Sports And Movement", activity_name: "Ball Skills", description: "Learners practise rolling, throwing, catching or kicking a ball.", developmental_area: "Gross Motor" },
  { theme: "Sports And Movement", activity_name: "Obstacle Course", description: "Learners move through a safe obstacle course.", developmental_area: "Gross Motor" },
  { theme: "Sports And Movement", activity_name: "Running Games", description: "Learners take part in simple running games.", developmental_area: "Gross Motor" },
  { theme: "Sports And Movement", activity_name: "Teamwork Games", description: "Learners play group games that encourage cooperation.", developmental_area: "Life Skills" },
  { theme: "Sports And Movement", activity_name: "Sports Day Activities", description: "Learners practise simple sports day activities.", developmental_area: "Gross Motor" },

  // RECYCLING
  { theme: "Recycling", activity_name: "Reduce Reuse Recycle", description: "Learners discuss reducing, reusing and recycling in simple terms.", developmental_area: "Life Skills" },
  { theme: "Recycling", activity_name: "Recycling Sorting", description: "Learners sort clean recyclable materials.", developmental_area: "Mathematics" },
  { theme: "Recycling", activity_name: "Recycled Art", description: "Learners create artwork using clean recycled material.", developmental_area: "Creative Art" },
  { theme: "Recycling", activity_name: "Clean Environment", description: "Learners discuss keeping the classroom and playground clean.", developmental_area: "Life Skills" },
  { theme: "Recycling", activity_name: "Recycling Role Play", description: "Learners role play sorting and recycling materials.", developmental_area: "Life Skills" },

  // GRADE R READINESS
  { theme: "Grade R Readiness", activity_name: "Pencil Control", description: "Learners practise tracing, drawing lines and controlling a pencil.", developmental_area: "Fine Motor" },
  { theme: "Grade R Readiness", activity_name: "Listening Skills", description: "Learners listen carefully and respond to instructions.", developmental_area: "Language" },
  { theme: "Grade R Readiness", activity_name: "Following Instructions", description: "Learners follow one-step and two-step instructions.", developmental_area: "Life Skills" },
  { theme: "Grade R Readiness", activity_name: "Number Readiness", description: "Learners count objects and recognise basic numbers.", developmental_area: "Mathematics" },
  { theme: "Grade R Readiness", activity_name: "School Readiness Activities", description: "Learners practise routines, independence and classroom participation.", developmental_area: "Life Skills" },
];