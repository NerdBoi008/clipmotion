# Contributing Your Component

Thank you for contributing to ClipMotion! 🎬

## Next Steps

1. **Implement the animation**
   - Add your animation logic to the component file
   - Use the video reference for accuracy
   - Keep it performant and accessible

2. **Add dependencies**
   - If you need external libraries (framer-motion, gsap, etc.), add them to package.json
   - Document all dependencies in README.md

3. **Test thoroughly**
   - Test on different screen sizes
   - Check browser compatibility
   - Verify accessibility

4. **Add examples**
   - Update the example file with real usage
   - Add variants if applicable

5. **Build the registry**

   ```bash
   npm run registry:build
   ```

6. **Submit PR**
   - Create a pull request with your changes
   - Link to the source video
   - Add a demo GIF if possible

## File Structure

```tsx
registry/<framework>/
├── ui/              # Your component goes here
├── examples/        # Usage examples
└── README.md        # Documentation
```

## Questions?

- Check the [contribution guidelines](../../CONTRIBUTING.md)
- Open a discussion on GitHub
- Join our Discord community

Happy coding! 🚀
