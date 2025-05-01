const { Builder, By, Key, until } = require('selenium-webdriver')
const assert = require('assert')

describe('SearchNews', function() {
  this.timeout(30000)
  let driver
  let vars
  beforeEach(async function() {
    driver = await new Builder().forBrowser('chrome').build()
    vars = {}
  })
  afterEach(async function() {
    await driver.quit();
  })
  it('SearchNews', async function() {
    await driver.get("https://volunteercentrecounty.org/blog")
    await driver.manage().window().setRect({ width: 1440, height: 900 })
    
    // Wait for the page to load and search input to be visible
    await driver.wait(until.elementLocated(By.css('input[placeholder="Search"]')), 10000)
    const searchInput = await driver.findElement(By.css('input[placeholder="Search"]'))
    await searchInput.click()
    
    // Clear any existing text and enter the search term
    await searchInput.clear()
    const searchTerm = "volunteer"
    await searchInput.sendKeys(searchTerm)
    
    // Wait for search results to load and stabilize
    await driver.wait(until.elementLocated(By.css('app-blog-list-item')), 10000)
    await driver.sleep(2000) // Additional wait for results to stabilize
    
    // Get all titles first to avoid stale elements
    const titles = []
    const items = await driver.findElements(By.css('app-blog-list-item'))
    console.log(`Found ${items.length} blog items on the page`)
    
    for (const item of items) {
        try {
            const title = await item.findElement(By.css('h4.font-semibold.text-24pxlh30px.font-Montserrat')).getText()
            titles.push(title)
            console.log(`Found title: ${title}`)
        } catch (error) {
            console.log(`Error getting title: ${error.message}`)
        }
    }
    
    // Now make a single API call to get all articles
    const apiResponse = await driver.executeScript(`
        return fetch('https://api.volunteercentrecounty.org/web-api/article/list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: {
                    limit: "50",
                    offset: "0",
                    order: "DESC",
                    orderBy: "lastRefreshed"
                },
                filter: {
                    search: "${searchTerm}",
                    tags: null,
                    categories: null,
                    partners: []
                }
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('API Response:', JSON.stringify(data, null, 2));
            return data.data;
        })
        .catch(error => {
            console.error('API Error:', error);
            return [];
        });
    `)
    
    console.log(`API returned ${apiResponse.length} articles`)
    
    const itemData = []
    for (const title of titles) {
        const matchingArticle = apiResponse.find(article => 
            article.title.toLowerCase().includes(title.toLowerCase()) || 
            title.toLowerCase().includes(article.title.toLowerCase())
        )
        
        if (matchingArticle) {
            itemData.push({ 
                title: matchingArticle.title, 
                lastRefreshed: matchingArticle.lastRefreshed 
            })
            console.log(`Matched article: ${matchingArticle.title} with lastRefreshed: ${matchingArticle.lastRefreshed}`)
        } else {
            console.log(`No matching article found in API for title: ${title}`)
        }
    }
    
    // Log the results
    console.log('\nSearch results sorted by lastRefreshed (DESC):')
    itemData.forEach((item, index) => {
        console.log(`${index + 1}. Title: ${item.title}, lastRefreshed: ${item.lastRefreshed}`)
    })
    
    // Verify sorting
    for (let i = 0; i < itemData.length - 1; i++) {
        const currentDate = new Date(itemData[i].lastRefreshed)
        const nextDate = new Date(itemData[i + 1].lastRefreshed)
        assert.ok(currentDate >= nextDate, 
            `Items are not sorted correctly by lastRefreshed. ${itemData[i].title} (${itemData[i].lastRefreshed}) should come before ${itemData[i + 1].title} (${itemData[i + 1].lastRefreshed})`)
    }
    
    // Assert that we found at least one item
    assert.ok(itemData.length > 0, `No items found with "${searchTerm}" in title`)
  })
})
