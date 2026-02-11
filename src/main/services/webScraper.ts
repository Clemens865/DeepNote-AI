export class WebScraperService {
  async scrape(_url: string): Promise<{ text: string; title: string }> {
    console.log('[WebScraper] scrape stub')
    return { text: '', title: '' }
  }
}

export const webScraperService = new WebScraperService()
