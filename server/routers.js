// server/routers.js ke andar scrapeVideoSource block ko isse replace karein:

const scrapeVideoSource = publicProcedure
  .input(z.object({
    movieTitle: z.string().min(1),
  }))
  .mutation(async ({ input }) => {
    try {
      console.log(`\n📡 Scraping video list for: ${input.movieTitle}`);
      
      const streams = await findVideoSource(input.movieTitle);

      if (streams && streams.length > 0) {
        return {
          success: true,
          sources: streams, // Pura Array Frontend ko bhej rahe hain
          source: 'prowlarr',
        };
      }

      return {
        success: false,
        message: 'No streams found on Prowlarr for this movie.',
      };
    } catch (error) {
      console.error('Error scraping video:', error);
      return {
        success: false,
        message: error.message, // Error UI par dikhane ke liye
      };
    }
  });
