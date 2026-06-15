export type DefaultActivityLibraryItem = {
  developmental_area: string;
  theme: string;
  activity_name: string;
  description: string;
};

export const defaultActivityLibrary: DefaultActivityLibraryItem[] = [
  // 1. Language and Communication
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Family Picture Talk", description: "Learners look at family pictures and talk about family members using simple sentences." },
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Family Role Play", description: "Learners act out simple family roles and practise speaking respectfully." },
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Family Story Circle", description: "Learners listen to and share short stories about family life." },
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Who Lives in My House?", description: "Learners name people who live with them and describe their roles." },
  { developmental_area: "Language and Communication", theme: "My Family", activity_name: "Family Vocabulary Matching", description: "Learners match family words to pictures and practise saying each word clearly." },

  { developmental_area: "Language and Communication", theme: "Animals", activity_name: "Animal Sound Story", description: "Learners listen to an animal story and copy the sounds made by different animals." },
  { developmental_area: "Language and Communication", theme: "Animals", activity_name: "Animal Picture Discussion", description: "Learners describe animal pictures using names, sounds, colours and actions." },
  { developmental_area: "Language and Communication", theme: "Animals", activity_name: "Guess the Animal", description: "Learners listen to clues and guess the animal being described." },
  { developmental_area: "Language and Communication", theme: "Animals", activity_name: "Farm Animal Role Play", description: "Learners act out farm animals and talk about where they live." },
  { developmental_area: "Language and Communication", theme: "Animals", activity_name: "Jungle Story Time", description: "Learners listen to a jungle-themed story and answer simple questions." },

  { developmental_area: "Language and Communication", theme: "Transport", activity_name: "Vehicle Picture Talk", description: "Learners name vehicles and explain where or how they are used." },
  { developmental_area: "Language and Communication", theme: "Transport", activity_name: "Transport Matching Game", description: "Learners match vehicles to land, air or water transport." },
  { developmental_area: "Language and Communication", theme: "Transport", activity_name: "Name the Vehicle", description: "Learners identify vehicles from pictures and practise correct vocabulary." },
  { developmental_area: "Language and Communication", theme: "Transport", activity_name: "Traffic Story Discussion", description: "Learners listen to a road safety story and discuss what happened." },
  { developmental_area: "Language and Communication", theme: "Transport", activity_name: "Transport Vocabulary Practice", description: "Learners practise transport-related words through repetition and picture prompts." },

  { developmental_area: "Language and Communication", theme: "Community Helpers", activity_name: "Doctor and Nurse Role Play", description: "Learners act out visiting a clinic and practise helper-related vocabulary." },
  { developmental_area: "Language and Communication", theme: "Community Helpers", activity_name: "Firefighter Story Time", description: "Learners listen to a firefighter story and discuss safety and helping others." },
  { developmental_area: "Language and Communication", theme: "Community Helpers", activity_name: "Occupation Matching", description: "Learners match community helpers to their tools and workplaces." },
  { developmental_area: "Language and Communication", theme: "Community Helpers", activity_name: "Community Helper Discussion", description: "Learners talk about people who help in the community and what they do." },
  { developmental_area: "Language and Communication", theme: "Community Helpers", activity_name: "Dress-Up Activity", description: "Learners dress up as helpers and explain their role to the group." },

  { developmental_area: "Language and Communication", theme: "Seasons and Weather", activity_name: "Weather Discussion", description: "Learners talk about the weather and choose words to describe it." },
  { developmental_area: "Language and Communication", theme: "Seasons and Weather", activity_name: "Daily Weather Chart", description: "Learners observe the weather and mark it on a classroom chart." },
  { developmental_area: "Language and Communication", theme: "Seasons and Weather", activity_name: "Season Vocabulary Game", description: "Learners practise words linked to summer, winter, autumn and spring." },
  { developmental_area: "Language and Communication", theme: "Seasons and Weather", activity_name: "Rainy Day Story", description: "Learners listen to a rainy day story and describe what people wear or do." },
  { developmental_area: "Language and Communication", theme: "Seasons and Weather", activity_name: "Weather Picture Matching", description: "Learners match weather words to pictures." },

  { developmental_area: "Language and Communication", theme: "Languages Around Us", activity_name: "Greeting in Different Languages", description: "Learners practise greeting one another in different South African languages." },
  { developmental_area: "Language and Communication", theme: "Languages Around Us", activity_name: "Language Picture Cards", description: "Learners use picture cards to learn simple words in different languages." },
  { developmental_area: "Language and Communication", theme: "Languages Around Us", activity_name: "Listening and Repeating", description: "Learners listen to short words or phrases and repeat them clearly." },
  { developmental_area: "Language and Communication", theme: "Languages Around Us", activity_name: "Language Awareness Circle", description: "Learners share languages they hear at home, school or in the community." },
  { developmental_area: "Language and Communication", theme: "Languages Around Us", activity_name: "Multilingual Story Time", description: "Learners listen to a familiar story with words from more than one language." },

  // 2. Early Mathematics
  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Counting Objects", description: "Learners count classroom objects and match the total to number cards." },
  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Number Matching", description: "Learners match number symbols to groups of objects." },
  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Number Hunt", description: "Learners search for number cards around the classroom and identify them." },
  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Counting Songs", description: "Learners sing counting songs and show numbers using fingers or objects." },
  { developmental_area: "Early Mathematics", theme: "Numbers", activity_name: "Number Sequencing", description: "Learners arrange number cards in the correct order." },

  { developmental_area: "Early Mathematics", theme: "Shapes", activity_name: "Shape Sorting", description: "Learners sort shapes by colour, size and type while naming each shape." },
  { developmental_area: "Early Mathematics", theme: "Shapes", activity_name: "Shape Hunt", description: "Learners look for shapes in the classroom and name what they find." },
  { developmental_area: "Early Mathematics", theme: "Shapes", activity_name: "Build With Shapes", description: "Learners use shapes to build pictures or simple structures." },
  { developmental_area: "Early Mathematics", theme: "Shapes", activity_name: "Shape Tracing", description: "Learners trace shapes to recognise outlines and develop control." },
  { developmental_area: "Early Mathematics", theme: "Shapes", activity_name: "Shape Matching", description: "Learners match identical shapes and describe their features." },

  { developmental_area: "Early Mathematics", theme: "Patterns", activity_name: "Bead Pattern Making", description: "Learners create repeating patterns using beads." },
  { developmental_area: "Early Mathematics", theme: "Patterns", activity_name: "Colour Pattern Cards", description: "Learners continue colour patterns shown on cards." },
  { developmental_area: "Early Mathematics", theme: "Patterns", activity_name: "Block Pattern Building", description: "Learners build simple patterns using blocks." },
  { developmental_area: "Early Mathematics", theme: "Patterns", activity_name: "Pattern Completion", description: "Learners identify what comes next in a simple pattern." },
  { developmental_area: "Early Mathematics", theme: "Patterns", activity_name: "Nature Pattern Creation", description: "Learners create patterns using leaves, stones or sticks." },

  { developmental_area: "Early Mathematics", theme: "Measurement", activity_name: "Long and Short Comparison", description: "Learners compare objects and identify which are long or short." },
  { developmental_area: "Early Mathematics", theme: "Measurement", activity_name: "Heavy and Light Activity", description: "Learners compare objects by weight using hands or a balance scale." },
  { developmental_area: "Early Mathematics", theme: "Measurement", activity_name: "Tall and Short Sorting", description: "Learners sort objects or pictures by height." },
  { developmental_area: "Early Mathematics", theme: "Measurement", activity_name: "Capacity Exploration", description: "Learners explore full, empty, more and less using containers." },
  { developmental_area: "Early Mathematics", theme: "Measurement", activity_name: "Size Matching", description: "Learners match objects by size and describe them as big, small or medium." },

  { developmental_area: "Early Mathematics", theme: "Sorting and Classification", activity_name: "Colour Sorting", description: "Learners sort objects into groups according to colour." },
  { developmental_area: "Early Mathematics", theme: "Sorting and Classification", activity_name: "Animal Sorting", description: "Learners sort animals by type, size or where they live." },
  { developmental_area: "Early Mathematics", theme: "Sorting and Classification", activity_name: "Shape Classification", description: "Learners group shapes according to their properties." },
  { developmental_area: "Early Mathematics", theme: "Sorting and Classification", activity_name: "Food Group Sorting", description: "Learners sort food pictures into simple groups." },
  { developmental_area: "Early Mathematics", theme: "Sorting and Classification", activity_name: "Object Grouping", description: "Learners group classroom objects by shared features." },

  { developmental_area: "Early Mathematics", theme: "Days of the Week", activity_name: "Days of the Week Song", description: "Learners sing the days of the week in order." },
  { developmental_area: "Early Mathematics", theme: "Days of the Week", activity_name: "Ordering the Days", description: "Learners place the days of the week in the correct order." },
  { developmental_area: "Early Mathematics", theme: "Days of the Week", activity_name: "Today, Yesterday and Tomorrow", description: "Learners identify today, yesterday and tomorrow using the class calendar." },
  { developmental_area: "Early Mathematics", theme: "Days of the Week", activity_name: "School Week Discussion", description: "Learners discuss what happens on different school days." },
  { developmental_area: "Early Mathematics", theme: "Days of the Week", activity_name: "Daily Routine Sequencing", description: "Learners sequence daily events from morning to afternoon." },

  { developmental_area: "Early Mathematics", theme: "Months of the Year", activity_name: "Months of the Year Song", description: "Learners sing the months of the year in order." },
  { developmental_area: "Early Mathematics", theme: "Months of the Year", activity_name: "Birthday Month Chart", description: "Learners place birthdays on a class birthday month chart." },
  { developmental_area: "Early Mathematics", theme: "Months of the Year", activity_name: "Calendar Talk", description: "Learners talk about the current month and familiar events." },
  { developmental_area: "Early Mathematics", theme: "Months of the Year", activity_name: "Month Sequencing", description: "Learners arrange month cards in the correct order." },
  { developmental_area: "Early Mathematics", theme: "Months of the Year", activity_name: "Season and Month Matching", description: "Learners match months to seasons or weather pictures." },

  { developmental_area: "Early Mathematics", theme: "Calendar Time", activity_name: "Daily Calendar Discussion", description: "Learners identify the day, date and month during calendar time." },
  { developmental_area: "Early Mathematics", theme: "Calendar Time", activity_name: "Mark Today's Date", description: "Learners mark today's date on a classroom calendar." },
  { developmental_area: "Early Mathematics", theme: "Calendar Time", activity_name: "Weekend and Weekday Sorting", description: "Learners sort days into weekdays and weekend days." },
  { developmental_area: "Early Mathematics", theme: "Calendar Time", activity_name: "Monthly Calendar Review", description: "Learners review important days on the monthly calendar." },
  { developmental_area: "Early Mathematics", theme: "Calendar Time", activity_name: "Special Days Calendar", description: "Learners identify birthdays, holidays and school events on a calendar." },

  // 3. Fine Motor Development
  { developmental_area: "Fine Motor Development", theme: "Pencil Control", activity_name: "Tracing Lines", description: "Learners trace straight, curved and zigzag lines to develop pencil control." },
  { developmental_area: "Fine Motor Development", theme: "Pencil Control", activity_name: "Dot-to-Dot Activities", description: "Learners join dots to complete simple pictures or shapes." },
  { developmental_area: "Fine Motor Development", theme: "Pencil Control", activity_name: "Pattern Drawing", description: "Learners copy and draw simple line patterns." },
  { developmental_area: "Fine Motor Development", theme: "Pencil Control", activity_name: "Pencil Path Following", description: "Learners guide a pencil along a path without crossing the lines." },
  { developmental_area: "Fine Motor Development", theme: "Pencil Control", activity_name: "Shape Tracing", description: "Learners trace shapes to improve hand control." },

  { developmental_area: "Fine Motor Development", theme: "Cutting Skills", activity_name: "Straight Line Cutting", description: "Learners practise cutting safely along straight lines." },
  { developmental_area: "Fine Motor Development", theme: "Cutting Skills", activity_name: "Curved Line Cutting", description: "Learners practise cutting along curved lines." },
  { developmental_area: "Fine Motor Development", theme: "Cutting Skills", activity_name: "Shape Cutting", description: "Learners cut out simple shapes using child-safe scissors." },
  { developmental_area: "Fine Motor Development", theme: "Cutting Skills", activity_name: "Picture Cutting", description: "Learners cut around simple pictures to practise control." },
  { developmental_area: "Fine Motor Development", theme: "Cutting Skills", activity_name: "Craft Cutting", description: "Learners cut paper pieces for a simple craft activity." },

  { developmental_area: "Fine Motor Development", theme: "Hand Strength", activity_name: "Play Dough Moulding", description: "Learners squeeze, roll and shape play dough to build hand strength." },
  { developmental_area: "Fine Motor Development", theme: "Hand Strength", activity_name: "Peg Board Activity", description: "Learners place pegs into a board to strengthen finger control." },
  { developmental_area: "Fine Motor Development", theme: "Hand Strength", activity_name: "Threading Beads", description: "Learners thread beads to improve hand control and coordination." },
  { developmental_area: "Fine Motor Development", theme: "Hand Strength", activity_name: "Sponge Squeezing", description: "Learners squeeze water from sponges to strengthen hand muscles." },
  { developmental_area: "Fine Motor Development", theme: "Hand Strength", activity_name: "Tweezers Transfer", description: "Learners use tweezers to move small objects from one container to another." },

  { developmental_area: "Fine Motor Development", theme: "Creative Crafts", activity_name: "Tearing and Pasting", description: "Learners tear paper pieces and paste them into a picture." },
  { developmental_area: "Fine Motor Development", theme: "Creative Crafts", activity_name: "Paper Folding", description: "Learners fold paper to create simple shapes or objects." },
  { developmental_area: "Fine Motor Development", theme: "Creative Crafts", activity_name: "Sticker Placement", description: "Learners place stickers in selected areas to practise accuracy." },
  { developmental_area: "Fine Motor Development", theme: "Creative Crafts", activity_name: "Collage Making", description: "Learners make a collage using paper, pictures or recycled material." },
  { developmental_area: "Fine Motor Development", theme: "Creative Crafts", activity_name: "Card Making", description: "Learners create a simple card using drawing, cutting and pasting." },

  // 4. Gross Motor Development
  { developmental_area: "Gross Motor Development", theme: "Movement Skills", activity_name: "Obstacle Course", description: "Learners move through a simple obstacle course using crawling, jumping and balancing." },
  { developmental_area: "Gross Motor Development", theme: "Movement Skills", activity_name: "Jumping Practice", description: "Learners practise jumping forward, backward and over low objects." },
  { developmental_area: "Gross Motor Development", theme: "Movement Skills", activity_name: "Running Games", description: "Learners participate in short running games to build movement control." },
  { developmental_area: "Gross Motor Development", theme: "Movement Skills", activity_name: "Balance Walk", description: "Learners walk along a line or low beam to practise balance." },
  { developmental_area: "Gross Motor Development", theme: "Movement Skills", activity_name: "Hopping Challenge", description: "Learners practise hopping on one foot and changing feet." },

  { developmental_area: "Gross Motor Development", theme: "Ball Skills", activity_name: "Throw and Catch", description: "Learners practise throwing and catching a ball with control." },
  { developmental_area: "Gross Motor Development", theme: "Ball Skills", activity_name: "Rolling Ball Games", description: "Learners roll balls to a partner or target." },
  { developmental_area: "Gross Motor Development", theme: "Ball Skills", activity_name: "Target Practice", description: "Learners throw bean bags or balls toward a target." },
  { developmental_area: "Gross Motor Development", theme: "Ball Skills", activity_name: "Partner Passing", description: "Learners pass a ball to a partner using both hands." },
  { developmental_area: "Gross Motor Development", theme: "Ball Skills", activity_name: "Bounce and Catch", description: "Learners bounce a ball and catch it safely." },

  { developmental_area: "Gross Motor Development", theme: "Coordination", activity_name: "Follow the Leader", description: "Learners follow movement instructions and copy body actions." },
  { developmental_area: "Gross Motor Development", theme: "Coordination", activity_name: "Movement Circuits", description: "Learners move through stations that require different body movements." },
  { developmental_area: "Gross Motor Development", theme: "Coordination", activity_name: "Bean Bag Activities", description: "Learners balance, toss and carry bean bags during movement games." },
  { developmental_area: "Gross Motor Development", theme: "Coordination", activity_name: "Action Commands", description: "Learners listen to commands and respond with the correct movement." },
  { developmental_area: "Gross Motor Development", theme: "Coordination", activity_name: "Directional Movement", description: "Learners move forward, backward, sideways, left and right." },

  { developmental_area: "Gross Motor Development", theme: "Outdoor Fitness", activity_name: "Relay Races", description: "Learners participate in short relay activities using safe movement." },
  { developmental_area: "Gross Motor Development", theme: "Outdoor Fitness", activity_name: "Playground Challenges", description: "Learners use playground equipment safely to practise movement skills." },
  { developmental_area: "Gross Motor Development", theme: "Outdoor Fitness", activity_name: "Nature Walk Movement", description: "Learners move outdoors while observing and responding to nature prompts." },
  { developmental_area: "Gross Motor Development", theme: "Outdoor Fitness", activity_name: "Group Games", description: "Learners play simple group games that encourage movement and teamwork." },
  { developmental_area: "Gross Motor Development", theme: "Outdoor Fitness", activity_name: "Fitness Stations", description: "Learners rotate through simple physical activity stations." },

  // 5. Creative Development
  { developmental_area: "Creative Development", theme: "Art and Drawing", activity_name: "Draw My Family", description: "Learners draw their family and describe who is in the picture." },
  { developmental_area: "Creative Development", theme: "Art and Drawing", activity_name: "Free Drawing", description: "Learners draw freely and talk about what they created." },
  { developmental_area: "Creative Development", theme: "Art and Drawing", activity_name: "Nature Art", description: "Learners use natural materials or nature ideas to create artwork." },
  { developmental_area: "Creative Development", theme: "Art and Drawing", activity_name: "Painting Activity", description: "Learners paint a picture linked to the classroom theme." },
  { developmental_area: "Creative Development", theme: "Art and Drawing", activity_name: "Colour Mixing", description: "Learners mix colours and observe what new colours are made." },

  { developmental_area: "Creative Development", theme: "Music Exploration", activity_name: "Rhythm Practice", description: "Learners copy simple rhythms using claps, taps or instruments." },
  { developmental_area: "Creative Development", theme: "Music Exploration", activity_name: "Instrument Exploration", description: "Learners explore classroom instruments and describe their sounds." },
  { developmental_area: "Creative Development", theme: "Music Exploration", activity_name: "Singing Circle", description: "Learners sing familiar songs together in a group." },
  { developmental_area: "Creative Development", theme: "Music Exploration", activity_name: "Musical Freeze", description: "Learners move to music and freeze when the music stops." },
  { developmental_area: "Creative Development", theme: "Music Exploration", activity_name: "Action Songs", description: "Learners sing songs with actions and body movements." },

  { developmental_area: "Creative Development", theme: "Drama and Role Play", activity_name: "Puppet Show", description: "Learners use puppets to act out a simple story." },
  { developmental_area: "Creative Development", theme: "Drama and Role Play", activity_name: "Story Acting", description: "Learners act out parts of a story using movement and speech." },
  { developmental_area: "Creative Development", theme: "Drama and Role Play", activity_name: "Role Play Activity", description: "Learners act out real-life situations linked to the weekly theme." },
  { developmental_area: "Creative Development", theme: "Drama and Role Play", activity_name: "Character Imitation", description: "Learners copy actions or voices of story characters." },
  { developmental_area: "Creative Development", theme: "Drama and Role Play", activity_name: "Imagination Games", description: "Learners use imagination to create pretend scenarios." },

  { developmental_area: "Creative Development", theme: "Creative Construction", activity_name: "Block Building", description: "Learners build simple structures using blocks and describe them." },
  { developmental_area: "Creative Development", theme: "Creative Construction", activity_name: "Recycled Material Models", description: "Learners create models using clean recycled materials." },
  { developmental_area: "Creative Development", theme: "Creative Construction", activity_name: "Sand Construction", description: "Learners build shapes or structures using sand." },
  { developmental_area: "Creative Development", theme: "Creative Construction", activity_name: "Lego Challenges", description: "Learners complete simple building challenges using Lego or blocks." },
  { developmental_area: "Creative Development", theme: "Creative Construction", activity_name: "Design and Build", description: "Learners plan and build a simple object using available materials." },

  // 6. Social and Emotional Development
  { developmental_area: "Social and Emotional Development", theme: "Feelings", activity_name: "Feelings Circle", description: "Learners identify emotions and share how they feel using picture prompts." },
  { developmental_area: "Social and Emotional Development", theme: "Feelings", activity_name: "Emotion Cards", description: "Learners match emotion cards to facial expressions or situations." },
  { developmental_area: "Social and Emotional Development", theme: "Feelings", activity_name: "Happy and Sad Stories", description: "Learners listen to short stories and identify happy or sad moments." },
  { developmental_area: "Social and Emotional Development", theme: "Feelings", activity_name: "Emotion Matching", description: "Learners match emotion words to pictures." },
  { developmental_area: "Social and Emotional Development", theme: "Feelings", activity_name: "Feelings Discussion", description: "Learners talk about feelings and what can cause them." },

  { developmental_area: "Social and Emotional Development", theme: "Relationships", activity_name: "Friendship Activities", description: "Learners practise friendly actions such as sharing, greeting and helping." },
  { developmental_area: "Social and Emotional Development", theme: "Relationships", activity_name: "Sharing Games", description: "Learners practise sharing materials and taking turns." },
  { developmental_area: "Social and Emotional Development", theme: "Relationships", activity_name: "Team Challenges", description: "Learners complete simple activities in pairs or groups." },
  { developmental_area: "Social and Emotional Development", theme: "Relationships", activity_name: "Helping Others", description: "Learners discuss and practise ways to help classmates." },
  { developmental_area: "Social and Emotional Development", theme: "Relationships", activity_name: "Group Story Creation", description: "Learners work together to create a simple group story." },

  { developmental_area: "Social and Emotional Development", theme: "Self-Awareness", activity_name: "All About Me", description: "Learners talk about their likes, strengths and personal features." },
  { developmental_area: "Social and Emotional Development", theme: "Self-Awareness", activity_name: "My Strengths", description: "Learners identify simple things they can do well." },
  { developmental_area: "Social and Emotional Development", theme: "Self-Awareness", activity_name: "My Favourite Things", description: "Learners share favourite colours, foods, toys or activities." },
  { developmental_area: "Social and Emotional Development", theme: "Self-Awareness", activity_name: "Personal Goals", description: "Learners talk about something they want to practise or learn." },
  { developmental_area: "Social and Emotional Development", theme: "Self-Awareness", activity_name: "Self-Portrait Activity", description: "Learners draw themselves and describe their picture." },

  { developmental_area: "Social and Emotional Development", theme: "Conflict Resolution", activity_name: "Problem Solving Stories", description: "Learners listen to simple problem stories and discuss possible solutions." },
  { developmental_area: "Social and Emotional Development", theme: "Conflict Resolution", activity_name: "Taking Turns Practice", description: "Learners practise waiting, listening and taking turns during play." },
  { developmental_area: "Social and Emotional Development", theme: "Conflict Resolution", activity_name: "Kindness Activities", description: "Learners practise kind words and helpful actions." },
  { developmental_area: "Social and Emotional Development", theme: "Conflict Resolution", activity_name: "Listening Games", description: "Learners practise listening carefully before responding." },
  { developmental_area: "Social and Emotional Development", theme: "Conflict Resolution", activity_name: "Classroom Agreements", description: "Learners discuss simple classroom rules and why they matter." },

  // 7. Life Skills
  { developmental_area: "Life Skills", theme: "My Family", activity_name: "Helping at Home", description: "Learners discuss simple ways they can help at home." },
  { developmental_area: "Life Skills", theme: "My Family", activity_name: "Family Responsibilities", description: "Learners talk about responsibilities different family members may have." },
  { developmental_area: "Life Skills", theme: "My Family", activity_name: "Caring for Others", description: "Learners discuss ways to care for younger, older or sick family members." },
  { developmental_area: "Life Skills", theme: "My Family", activity_name: "Family Traditions", description: "Learners share simple family traditions or routines." },
  { developmental_area: "Life Skills", theme: "My Family", activity_name: "Respecting Family Members", description: "Learners discuss respectful words and actions used at home." },
  
  { developmental_area: "Life Skills", theme: "My Body", activity_name: "Naming Body Parts", description: "Learners identify and name major body parts such as the head, arms, legs, eyes, ears, nose and mouth." },
  { developmental_area: "Life Skills", theme: "My Body", activity_name: "Five Senses Exploration", description: "Learners explore sight, hearing, smell, taste and touch through guided activities." },
  { developmental_area: "Life Skills", theme: "My Body", activity_name: "Healthy Body Habits", description: "Learners discuss healthy habits including bathing, brushing teeth, washing hands and drinking water." },
  { developmental_area: "Life Skills", theme: "My Body", activity_name: "Exercise and Movement", description: "Learners participate in movement activities and discuss why exercise is important." },
  { developmental_area: "Life Skills", theme: "My Body", activity_name: "Keeping My Body Safe", description: "Learners learn simple body safety rules and identify trusted adults who can help them." },

  { developmental_area: "Life Skills", theme: "My Home", activity_name: "Rooms in My Home", description: "Learners identify different rooms in a home and discuss their purposes." },
  { developmental_area: "Life Skills", theme: "My Home", activity_name: "People Who Live With Me", description: "Learners talk about family members and people who share their home." },
  { developmental_area: "Life Skills", theme: "My Home", activity_name: "Helping at Home", description: "Learners discuss age-appropriate responsibilities and chores at home." },
  { developmental_area: "Life Skills", theme: "My Home", activity_name: "Home Safety", description: "Learners identify safe and unsafe situations that may occur in the home." },
  { developmental_area: "Life Skills", theme: "My Home", activity_name: "Caring for My Home", description: "Learners discuss ways to keep their homes clean, tidy and organised." },

  { developmental_area: "Life Skills", theme: "Healthy Living", activity_name: "Handwashing Routine", description: "Learners practise washing hands correctly and explain when hands should be washed." },
  { developmental_area: "Life Skills", theme: "Healthy Living", activity_name: "Healthy Food Sorting", description: "Learners sort food pictures into everyday healthy choices and treats." },
  { developmental_area: "Life Skills", theme: "Healthy Living", activity_name: "Brushing Teeth Practice", description: "Learners practise steps for brushing teeth using pictures or models." },
  { developmental_area: "Life Skills", theme: "Healthy Living", activity_name: "Exercise and Movement", description: "Learners discuss why movement helps the body stay healthy." },
  { developmental_area: "Life Skills", theme: "Healthy Living", activity_name: "Personal Hygiene", description: "Learners identify hygiene habits such as bathing, washing hands and clean clothes." },

  { developmental_area: "Life Skills", theme: "Safety", activity_name: "Road Safety", description: "Learners identify safe ways to cross the road and follow road rules." },
  { developmental_area: "Life Skills", theme: "Safety", activity_name: "Stranger Danger", description: "Learners discuss safe behaviour around unfamiliar people." },
  { developmental_area: "Life Skills", theme: "Safety", activity_name: "Emergency Numbers", description: "Learners learn that emergency numbers are used when help is needed." },
  { developmental_area: "Life Skills", theme: "Safety", activity_name: "Fire Safety", description: "Learners discuss what to do if there is fire or smoke." },
  { developmental_area: "Life Skills", theme: "Safety", activity_name: "Safe Play Rules", description: "Learners identify safe and unsafe behaviour during play." },

  { developmental_area: "Life Skills", theme: "Daily Routines", activity_name: "Morning Routine", description: "Learners discuss common morning routines at home and school." },
  { developmental_area: "Life Skills", theme: "Daily Routines", activity_name: "Packing Away", description: "Learners practise sorting and packing classroom materials correctly." },
  { developmental_area: "Life Skills", theme: "Daily Routines", activity_name: "Time Awareness", description: "Learners talk about activities that happen in the morning, afternoon and evening." },
  { developmental_area: "Life Skills", theme: "Daily Routines", activity_name: "Classroom Responsibilities", description: "Learners practise simple classroom jobs and responsibilities." },
  { developmental_area: "Life Skills", theme: "Daily Routines", activity_name: "Following Instructions", description: "Learners follow simple one-step and two-step instructions." },

  { developmental_area: "Life Skills", theme: "My Community", activity_name: "Places in Our Community", description: "Learners identify familiar places in their community and discuss what happens there." },
  { developmental_area: "Life Skills", theme: "My Community", activity_name: "Community Walk Discussion", description: "Learners discuss things they might see during a walk in the community." },
  { developmental_area: "Life Skills", theme: "My Community", activity_name: "Community Helper Locations", description: "Learners match helpers to places where they work." },
  { developmental_area: "Life Skills", theme: "My Community", activity_name: "Local Services Awareness", description: "Learners learn about simple services such as clinics, shops and police stations." },
  { developmental_area: "Life Skills", theme: "My Community", activity_name: "Community Picture Talk", description: "Learners use pictures to talk about people and places in the community." },

  { developmental_area: "Life Skills", theme: "South Africa", activity_name: "South African Flag Activity", description: "Learners identify the South African flag and discuss simple national symbols." },
  { developmental_area: "Life Skills", theme: "South Africa", activity_name: "National Symbols Discussion", description: "Learners are introduced to simple national symbols such as the flag and anthem." },
  { developmental_area: "Life Skills", theme: "South Africa", activity_name: "Our Country Discussion", description: "Learners talk about South Africa as the country where they live." },
  { developmental_area: "Life Skills", theme: "South Africa", activity_name: "Places in South Africa", description: "Learners identify familiar South African places through pictures." },
  { developmental_area: "Life Skills", theme: "South Africa", activity_name: "Celebrating Heritage", description: "Learners discuss clothing, food, music or traditions in a simple heritage activity." },

  { developmental_area: "Life Skills", theme: "Our Province", activity_name: "My Province Discussion", description: "Learners talk about the province they live in and familiar places around them." },
  { developmental_area: "Life Skills", theme: "Our Province", activity_name: "Province Map Matching", description: "Learners match province names or pictures to a simple South African map." },
  { developmental_area: "Life Skills", theme: "Our Province", activity_name: "Important Places in Our Province", description: "Learners identify important or familiar places in their province." },
  { developmental_area: "Life Skills", theme: "Our Province", activity_name: "Province Picture Talk", description: "Learners use pictures to discuss features of their province." },
  { developmental_area: "Life Skills", theme: "Our Province", activity_name: "Province Awareness Activity", description: "Learners learn the name of their province and simple facts about it." },

  { developmental_area: "Life Skills", theme: "Maps and Directions", activity_name: "Simple Map Reading", description: "Learners follow a very simple picture map to find familiar places." },
  { developmental_area: "Life Skills", theme: "Maps and Directions", activity_name: "Classroom Map", description: "Learners create or follow a simple classroom map using direction words." },
  { developmental_area: "Life Skills", theme: "Maps and Directions", activity_name: "Direction Words", description: "Learners practise words such as left, right, near, far, next to and behind." },
  { developmental_area: "Life Skills", theme: "Maps and Directions", activity_name: "Find the Place", description: "Learners use clues to find a place on a simple classroom or school map." },
  { developmental_area: "Life Skills", theme: "Maps and Directions", activity_name: "Left, Right, Near and Far", description: "Learners practise basic position and direction words through movement." },

  // 8. Sensory Development
  { developmental_area: "Sensory Development", theme: "Touch", activity_name: "Texture Exploration", description: "Learners touch and describe textures such as soft, rough, smooth and bumpy." },
  { developmental_area: "Sensory Development", theme: "Touch", activity_name: "Mystery Bag", description: "Learners feel objects inside a bag and guess what they are." },
  { developmental_area: "Sensory Development", theme: "Touch", activity_name: "Sand and Water Play", description: "Learners explore sand and water using hands, scoops and containers." },
  { developmental_area: "Sensory Development", theme: "Touch", activity_name: "Sensory Boards", description: "Learners explore boards with different textures and materials." },
  { developmental_area: "Sensory Development", theme: "Touch", activity_name: "Fabric Sorting", description: "Learners sort fabrics by texture, thickness or feel." },

  { developmental_area: "Sensory Development", theme: "Sound", activity_name: "Sound Matching", description: "Learners match sounds to objects or picture cards." },
  { developmental_area: "Sensory Development", theme: "Sound", activity_name: "Listening Walk", description: "Learners walk quietly and identify sounds they hear." },
  { developmental_area: "Sensory Development", theme: "Sound", activity_name: "Musical Sounds", description: "Learners listen to different instruments and describe the sounds." },
  { developmental_area: "Sensory Development", theme: "Sound", activity_name: "Guess the Sound", description: "Learners listen to a hidden sound and guess what made it." },
  { developmental_area: "Sensory Development", theme: "Sound", activity_name: "Nature Sounds", description: "Learners listen for birds, wind, water or other natural sounds." },

  { developmental_area: "Sensory Development", theme: "Sight", activity_name: "Colour Discovery", description: "Learners identify and group objects by colour." },
  { developmental_area: "Sensory Development", theme: "Sight", activity_name: "Light and Shadow", description: "Learners explore shadows and how light changes what they see." },
  { developmental_area: "Sensory Development", theme: "Sight", activity_name: "Visual Tracking", description: "Learners follow moving objects with their eyes." },
  { developmental_area: "Sensory Development", theme: "Sight", activity_name: "Spot the Difference", description: "Learners compare two pictures and identify differences." },
  { developmental_area: "Sensory Development", theme: "Sight", activity_name: "Pattern Observation", description: "Learners observe and describe visual patterns." },

  { developmental_area: "Sensory Development", theme: "Smell and Taste", activity_name: "Fruit Tasting", description: "Learners taste fruit and describe simple tastes." },
  { developmental_area: "Sensory Development", theme: "Smell and Taste", activity_name: "Herb Exploration", description: "Learners smell herbs and describe what they notice." },
  { developmental_area: "Sensory Development", theme: "Smell and Taste", activity_name: "Smell Matching", description: "Learners match familiar smells to pictures or objects." },
  { developmental_area: "Sensory Development", theme: "Smell and Taste", activity_name: "Sweet and Sour Comparison", description: "Learners compare simple sweet and sour tastes safely." },
  { developmental_area: "Sensory Development", theme: "Smell and Taste", activity_name: "Food Identification", description: "Learners identify familiar foods using smell, sight or taste." },

  // 9. Outdoor Play
  { developmental_area: "Outdoor Play", theme: "Nature Exploration", activity_name: "Nature Walk", description: "Learners walk outside and identify leaves, stones, flowers and insects." },
  { developmental_area: "Outdoor Play", theme: "Nature Exploration", activity_name: "Leaf Collection", description: "Learners collect safe leaves and compare their shapes, colours and sizes." },
  { developmental_area: "Outdoor Play", theme: "Nature Exploration", activity_name: "Insect Observation", description: "Learners observe insects safely and talk about what they see." },
  { developmental_area: "Outdoor Play", theme: "Nature Exploration", activity_name: "Plant Discovery", description: "Learners identify simple parts of plants during outdoor exploration." },
  { developmental_area: "Outdoor Play", theme: "Nature Exploration", activity_name: "Garden Exploration", description: "Learners explore a garden area and describe natural objects." },

  { developmental_area: "Outdoor Play", theme: "Physical Play", activity_name: "Relay Races", description: "Learners participate in short relay activities using safe movement." },
  { developmental_area: "Outdoor Play", theme: "Physical Play", activity_name: "Obstacle Challenges", description: "Learners move through outdoor obstacles while practising balance and coordination." },
  { developmental_area: "Outdoor Play", theme: "Physical Play", activity_name: "Free Play Stations", description: "Learners rotate through safe outdoor play stations." },
  { developmental_area: "Outdoor Play", theme: "Physical Play", activity_name: "Ball Games", description: "Learners play simple ball games that develop movement and teamwork." },
  { developmental_area: "Outdoor Play", theme: "Physical Play", activity_name: "Group Movement Games", description: "Learners participate in group games that encourage movement and cooperation." },

  { developmental_area: "Outdoor Play", theme: "Environmental Awareness", activity_name: "Recycling Activity", description: "Learners sort clean recyclable items into simple categories." },
  { developmental_area: "Outdoor Play", theme: "Environmental Awareness", activity_name: "Clean-Up Day", description: "Learners help clean a safe area and discuss caring for their environment." },
  { developmental_area: "Outdoor Play", theme: "Environmental Awareness", activity_name: "Water Conservation", description: "Learners discuss simple ways to save water." },
  { developmental_area: "Outdoor Play", theme: "Environmental Awareness", activity_name: "Caring for Plants", description: "Learners water or care for plants and discuss why plants matter." },
  { developmental_area: "Outdoor Play", theme: "Environmental Awareness", activity_name: "Nature Discussion", description: "Learners discuss how to care for animals, plants and outdoor spaces." },

  // 10. Music and Movement
  { developmental_area: "Music and Movement", theme: "Singing", activity_name: "Nursery Rhymes", description: "Learners sing familiar nursery rhymes and practise rhythm and words." },
  { developmental_area: "Music and Movement", theme: "Singing", activity_name: "Action Songs", description: "Learners sing action songs and follow movements such as clapping, jumping and turning." },
  { developmental_area: "Music and Movement", theme: "Singing", activity_name: "Group Singing", description: "Learners sing together and listen to the group rhythm." },
  { developmental_area: "Music and Movement", theme: "Singing", activity_name: "Echo Singing", description: "Learners listen to a line and repeat it back." },
  { developmental_area: "Music and Movement", theme: "Singing", activity_name: "Theme Songs", description: "Learners sing songs linked to the weekly classroom theme." },

  { developmental_area: "Music and Movement", theme: "Rhythm", activity_name: "Clapping Patterns", description: "Learners copy simple clapping patterns." },
  { developmental_area: "Music and Movement", theme: "Rhythm", activity_name: "Drum Activities", description: "Learners use drums or containers to follow a simple beat." },
  { developmental_area: "Music and Movement", theme: "Rhythm", activity_name: "Rhythm Sticks", description: "Learners tap rhythm sticks together to copy a beat." },
  { developmental_area: "Music and Movement", theme: "Rhythm", activity_name: "Beat Following", description: "Learners move or clap in time with a beat." },
  { developmental_area: "Music and Movement", theme: "Rhythm", activity_name: "Musical Echoes", description: "Learners repeat rhythm patterns after the teacher." },

  { developmental_area: "Music and Movement", theme: "Dance", activity_name: "Creative Dance", description: "Learners create simple movements in response to music." },
  { developmental_area: "Music and Movement", theme: "Dance", activity_name: "Cultural Dance", description: "Learners are introduced to simple cultural dance movements respectfully." },
  { developmental_area: "Music and Movement", theme: "Dance", activity_name: "Freeze Dance", description: "Learners move to music and freeze when the music stops." },
  { developmental_area: "Music and Movement", theme: "Dance", activity_name: "Follow the Beat", description: "Learners move their bodies according to the speed of the music." },
  { developmental_area: "Music and Movement", theme: "Dance", activity_name: "Movement Sequences", description: "Learners follow a short sequence of movements." },

  { developmental_area: "Music and Movement", theme: "Movement Games", activity_name: "Simon Says", description: "Learners listen carefully and follow movement instructions." },
  { developmental_area: "Music and Movement", theme: "Movement Games", activity_name: "Follow the Leader", description: "Learners copy the leader's actions during a movement game." },
  { developmental_area: "Music and Movement", theme: "Movement Games", activity_name: "Musical Statues", description: "Learners move to music and hold a statue pose when it stops." },
  { developmental_area: "Music and Movement", theme: "Movement Games", activity_name: "Action Commands", description: "Learners respond to commands with matching actions." },
  { developmental_area: "Music and Movement", theme: "Movement Games", activity_name: "Animal Movements", description: "Learners move like different animals while listening to instructions." },
];